import AppKit
import WebKit
import CoreGraphics
import CoreLocation

// The native companion owns only its window. Team state and rendering stay in the
// local web application, served by the separate loopback bridge process.
struct PlaygroundAddress {
    let url: URL
    let port: Int

    init?(_ value: String) {
        guard let components = URLComponents(string: value),
              components.scheme?.lowercased() == "http",
              let host = components.host?.lowercased(),
              host == "127.0.0.1" || host == "localhost",
              components.user == nil, components.password == nil,
              let url = components.url else { return nil }
        let port = components.port ?? 80
        guard (1...65535).contains(port) else { return nil }
        self.url = url
        self.port = port
    }

    func allows(_ candidate: URL?) -> Bool {
        guard let candidate,
              let address = PlaygroundAddress(candidate.absoluteString) else { return false }
        return address.port == port
    }
}

// The interactive window and desktop surface have separate lifecycles and
// keyboard policies. The same web view moves between them without a page reload.
final class PlaygroundWindow: NSWindow {
    var acceptsPlaygroundFocus = true
    override var canBecomeKey: Bool { acceptsPlaygroundFocus }
    override var canBecomeMain: Bool { acceptsPlaygroundFocus }
}

private enum WeatherLocationFailure: String {
    case disabled, denied, restricted, authorization, timeout, unavailable
}

final class PlaygroundDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate,
    WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, CLLocationManagerDelegate {
    private let address: PlaygroundAddress
    private var window: PlaygroundWindow!
    private var desktopWindow: PlaygroundWindow!
    private var contentContainer: NSView!
    private var webView: WKWebView!
    private var offlineView: NSView!
    private var offlineMessage: NSTextField!
    private var statusItem: NSStatusItem!
    private var floatMenuItems: [NSMenuItem] = []
    private var desktopMenuItems: [NSMenuItem] = []
    private var fullscreenMenuItems: [NSMenuItem] = []
    private var lastVisibility: Bool?
    private var floating: Bool
    private var desktopMode = false
    private var desktopScreenNumber: NSNumber?
    private var fullscreenTransitioning = false
    private var desktopAfterFullscreen = false
    private var weatherLocationManager: CLLocationManager?
    private var weatherLocationRequestID: String?
    private var weatherLocationTimer: Timer?
    private var locationAuthorizationRequested = false
    private var locationAuthorizationLoweredWindow = false
    private var locationFixStarted = false
    private var locationServicesChecked = false

    private let regularStyle: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
    private let frameAutosaveName = "PLaTOP.Playground"

    private var renderWindow: PlaygroundWindow? { desktopMode ? desktopWindow : window }
    private var interactiveWindowLevel: NSWindow.Level {
        floating && !locationAuthorizationLoweredWindow ? .floating : .normal
    }

    init(address: PlaygroundAddress) {
        self.address = address
        floating = UserDefaults.standard.object(forKey: "floatWindow") as? Bool ?? true
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildMenus()
        buildWindow()
        buildStatusMenu()
        NotificationCenter.default.addObserver(self, selector: #selector(screenLayoutChanged(_:)),
                                               name: NSApplication.didChangeScreenParametersNotification,
                                               object: nil)
        showPlayground(nil)
        reloadPlayground(nil)
    }

    private func menuItem(_ title: String, action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    private func floatItem() -> NSMenuItem {
        let item = menuItem("Float Window", action: #selector(toggleFloat(_:)))
        item.state = floating ? .on : .off
        floatMenuItems.append(item)
        return item
    }

    private func desktopItem() -> NSMenuItem {
        let item = menuItem("Desktop Background", action: #selector(toggleDesktop(_:)))
        desktopMenuItems.append(item)
        return item
    }

    private func fullscreenItem() -> NSMenuItem {
        let item = menuItem("Enter Full Screen", action: #selector(toggleFullscreen(_:)), key: "f")
        item.keyEquivalentModifierMask = [.command, .control]
        fullscreenMenuItems.append(item)
        return item
    }

    private func buildMenus() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "PLaTOP")
        appMenu.addItem(menuItem("Open Playground", action: #selector(showPlayground(_:)), key: "o"))
        appMenu.addItem(floatItem())
        appMenu.addItem(desktopItem())
        appMenu.addItem(fullscreenItem())
        appMenu.addItem(.separator())
        appMenu.addItem(menuItem("Reload Playground", action: #selector(reloadPlayground(_:)), key: "r"))
        appMenu.addItem(.separator())
        let hide = NSMenuItem(title: "Hide PLaTOP", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(hide)
        appMenu.addItem(.separator())
        appMenu.addItem(menuItem("Quit PLaTOP", action: #selector(quit(_:)), key: "q"))
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        for (title, selector, key) in [("Cut", "cut:", "x"), ("Copy", "copy:", "c"),
                                       ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            editMenu.addItem(NSMenuItem(title: title, action: Selector(selector), keyEquivalent: key))
        }
        editItem.submenu = editMenu
        mainMenu.addItem(editItem)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(menuItem("Minimize", action: #selector(minimize(_:)), key: "m"))
        windowMenu.addItem(menuItem("Close Window", action: #selector(hidePlayground(_:)), key: "w"))
        windowMenu.addItem(.separator())
        windowMenu.addItem(floatItem())
        windowMenu.addItem(desktopItem())
        windowMenu.addItem(fullscreenItem())
        windowItem.submenu = windowMenu
        mainMenu.addItem(windowItem)
        NSApp.mainMenu = mainMenu
        NSApp.windowsMenu = windowMenu
    }

    private func buildWindow() {
        window = PlaygroundWindow(contentRect: NSRect(x: 0, y: 0, width: 1000, height: 720),
                          styleMask: regularStyle,
                          backing: .buffered, defer: false)
        window.title = "PLaTOP"
        window.contentMinSize = NSSize(width: 440, height: 420)
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.delegate = self
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenPrimary]
        window.level = interactiveWindowLevel
        window.setFrameAutosaveName(frameAutosaveName)
        window.center()

        let configuration = WKWebViewConfiguration()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.userContentController.add(self, name: "platop")
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__PLATOP_NATIVE__ = true; window.__PLATOP_DESKTOP_MODE__ = false; window.__PLATOP_FULLSCREEN__ = false; window.__PLATOP_DESKTOP_VISIBLE__ = true;",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.translatesAutoresizingMaskIntoConstraints = false

        let content = NSView()
        content.autoresizingMask = [.width, .height]
        contentContainer = content
        window.contentView = content
        content.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            webView.topAnchor.constraint(equalTo: content.topAnchor),
            webView.bottomAnchor.constraint(equalTo: content.bottomAnchor)
        ])
        buildOfflineView(in: content)
    }

    private func buildOfflineView(in content: NSView) {
        offlineView = NSView()
        offlineView.wantsLayer = true
        offlineView.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        offlineView.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(offlineView)
        NSLayoutConstraint.activate([
            offlineView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            offlineView.topAnchor.constraint(equalTo: content.topAnchor),
            offlineView.bottomAnchor.constraint(equalTo: content.bottomAnchor)
        ])

        let heading = NSTextField(wrappingLabelWithString: "Your playground is taking a nap.")
        heading.font = NSFont.systemFont(ofSize: 25, weight: .semibold)
        heading.alignment = .center
        offlineMessage = NSTextField(wrappingLabelWithString: "")
        offlineMessage.font = NSFont.systemFont(ofSize: 14)
        offlineMessage.textColor = .secondaryLabelColor
        offlineMessage.alignment = .center
        let retry = NSButton(title: "Wake it up", target: self, action: #selector(reloadPlayground(_:)))
        retry.bezelStyle = .rounded
        retry.keyEquivalent = "\r"
        let stack = NSStackView(views: [heading, offlineMessage, retry])
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        offlineView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: offlineView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: offlineView.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: offlineView.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: offlineView.trailingAnchor, constant: -28),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 520),
            heading.widthAnchor.constraint(equalTo: stack.widthAnchor),
            offlineMessage.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
        offlineView.isHidden = true
    }

    private func buildStatusMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "square.stack.3d.up.fill",
                                   accessibilityDescription: "PLaTOP playground")
            if button.image == nil { button.title = "PL" }
            button.toolTip = "PLaTOP — your local team playground"
        }
        let menu = NSMenu()
        menu.addItem(menuItem("Open Playground", action: #selector(showPlayground(_:))))
        menu.addItem(floatItem())
        menu.addItem(desktopItem())
        menu.addItem(fullscreenItem())
        menu.addItem(.separator())
        menu.addItem(menuItem("Quit PLaTOP", action: #selector(quit(_:))))
        statusItem.menu = menu
    }

    @objc private func showPlayground(_ sender: Any?) {
        desktopAfterFullscreen = false
        leaveDesktop()
        NSApp.unhide(nil)
        if window.isMiniaturized { window.deminiaturize(nil) }
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
        window.makeMain()
        window.makeFirstResponder(webView)
        // Activation can complete on the next run-loop pass when returning from
        // a desktop-level window. Restore focus after that transition as well.
        DispatchQueue.main.async { [weak self] in
            guard let self, !self.desktopMode, self.window.isVisible,
                  !self.window.isMiniaturized, !self.fullscreenTransitioning,
                  NSApp.isActive else { return }
            self.window.makeKeyAndOrderFront(nil)
            self.window.makeMain()
            self.window.makeFirstResponder(self.webView)
        }
        publishVisibility()
        publishNativeState()
    }

    @objc private func toggleFloat(_ sender: Any?) {
        floating.toggle()
        UserDefaults.standard.set(floating, forKey: "floatWindow")
        if !desktopMode && !window.styleMask.contains(.fullScreen) {
            window.level = interactiveWindowLevel
        }
        for item in floatMenuItems { item.state = floating ? .on : .off }
    }

    @objc private func toggleFullscreen(_ sender: Any?) {
        guard !fullscreenTransitioning else { return }
        desktopAfterFullscreen = false
        if desktopMode { showPlayground(nil) }
        // A floating window cannot become the primary full-screen window.
        window.level = .normal
        window.collectionBehavior = [.fullScreenPrimary]
        window.toggleFullScreen(nil)
    }

    @objc private func toggleDesktop(_ sender: Any?) {
        guard !fullscreenTransitioning else { return }
        if desktopMode { showPlayground(nil); return }
        if window.styleMask.contains(.fullScreen) {
            desktopAfterFullscreen = true
            window.toggleFullScreen(nil)
            return
        }
        enterDesktop()
    }

    private func enterDesktop() {
        guard !desktopMode, let screen = window.screen ?? NSScreen.main else { return }
        if window.isMiniaturized { window.deminiaturize(nil) }
        if desktopWindow == nil {
            let background = PlaygroundWindow(contentRect: screen.frame,
                                               styleMask: [.borderless],
                                               backing: .buffered, defer: false)
            background.title = "PLaTOP Desktop"
            background.acceptsPlaygroundFocus = false
            background.isReleasedWhenClosed = false
            background.isExcludedFromWindowsMenu = true
            background.tabbingMode = .disallowed
            background.hasShadow = false
            background.ignoresMouseEvents = true
            background.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
            background.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) - 1)
            background.delegate = self
            desktopWindow = background
        }
        desktopScreenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
        desktopMode = true
        window.resignKey()
        window.resignMain()
        window.makeFirstResponder(nil)
        // Do not change the interactive window's style or mouse policy. AppKit
        // can retain stale event routing after converting one window between
        // borderless click-through and titled interactive styles.
        window.contentView = nil
        desktopWindow.contentView = contentContainer
        desktopWindow.setFrame(screen.frame, display: true)
        contentContainer.layoutSubtreeIfNeeded()
        window.orderOut(nil)
        NSApp.unhide(nil)
        desktopWindow.orderBack(nil)
        NSApp.deactivate()
        updateModeMenus()
        publishNativeState()
        publishVisibility(force: true)
    }

    private func leaveDesktop() {
        guard desktopMode else { return }
        desktopMode = false
        desktopWindow.contentView = nil
        window.contentView = contentContainer
        contentContainer.layoutSubtreeIfNeeded()
        desktopWindow.orderOut(nil)
        window.level = interactiveWindowLevel
        desktopScreenNumber = nil
        updateModeMenus()
    }

    @objc private func screenLayoutChanged(_ notification: Notification) {
        guard desktopMode else { return }
        let screen = NSScreen.screens.first {
            ($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber) == desktopScreenNumber
        } ?? NSScreen.main
        if let screen { desktopWindow.setFrame(screen.frame, display: true) }
    }

    private func updateModeMenus() {
        let fullscreen = window.styleMask.contains(.fullScreen)
        for item in desktopMenuItems { item.state = desktopMode ? .on : .off }
        for item in fullscreenMenuItems {
            item.title = fullscreen ? "Exit Full Screen" : "Enter Full Screen"
            item.state = fullscreen ? .on : .off
        }
    }

    private func publishNativeState() {
        guard webView != nil else { return }
        let desktop = desktopMode ? "true" : "false"
        let fullscreen = window.styleMask.contains(.fullScreen) ? "true" : "false"
        webView.evaluateJavaScript("""
            window.__PLATOP_NATIVE__ = true;
            window.__PLATOP_DESKTOP_MODE__ = \(desktop);
            window.__PLATOP_FULLSCREEN__ = \(fullscreen);
            window.dispatchEvent(new CustomEvent('platop:native', {detail: {desktop: \(desktop), fullscreen: \(fullscreen)}}));
            """, completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        // Reject subframes, other origins/ports, extra fields and arbitrary code.
        let origin = message.frameInfo.securityOrigin
        guard message.name == "platop", message.frameInfo.isMainFrame,
              origin.protocol.lowercased() == "http",
              ["localhost", "127.0.0.1"].contains(origin.host.lowercased()),
              (origin.port == 0 ? 80 : origin.port) == address.port,
              address.allows(message.frameInfo.request.url),
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        switch action {
        case "fullscreen", "desktop", "window":
            guard body.count == 1 else { return }
            if action == "fullscreen" { toggleFullscreen(nil) }
            else if action == "desktop" { toggleDesktop(nil) }
            else { showPlayground(nil) }
        case "location", "cancel-location":
            guard body.count == 2, let requestID = body["requestId"] as? String,
                  UUID(uuidString: requestID) != nil else { return }
            if action == "location" { requestWeatherLocation(requestID: requestID) }
            else if weatherLocationRequestID == requestID { cancelWeatherLocation() }
        default: break
        }
    }

    private func requestWeatherLocation(requestID: String) {
        cancelWeatherLocation()
        let manager = CLLocationManager()
        weatherLocationManager = manager
        weatherLocationRequestID = requestID
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
        manager.delegate = self
        // Permission belongs to a separate macOS dialog. Give the person time to
        // find it before starting the shorter, one-shot location-fix deadline.
        armWeatherLocationTimeout(requestID: requestID, seconds: 90, failure: .authorization)
        DispatchQueue.global(qos: .utility).async { [weak self] in
            let enabled = CLLocationManager.locationServicesEnabled()
            DispatchQueue.main.async {
                guard let self, self.weatherLocationRequestID == requestID,
                      manager === self.weatherLocationManager else { return }
                self.locationServicesChecked = true
                if enabled { self.continueWeatherLocation(manager) }
                else { self.finishWeatherLocation(failure: .disabled) }
            }
        }
    }

    private func continueWeatherLocation(_ manager: CLLocationManager) {
        guard manager === weatherLocationManager, weatherLocationRequestID != nil,
              locationServicesChecked else { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            guard !locationAuthorizationRequested else { return }
            locationAuthorizationRequested = true
            // The system permission dialog belongs to CoreLocationAgent. A
            // floating companion can intercept clicks intended for that dialog.
            // Keep the saved preference, but lower only while permission is open.
            locationAuthorizationLoweredWindow = true
            if !window.styleMask.contains(.fullScreen) { window.level = .normal }
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            restoreWeatherLocationWindowLevel()
            guard !locationFixStarted else { return }
            locationFixStarted = true
            if let requestID = weatherLocationRequestID {
                armWeatherLocationTimeout(requestID: requestID, seconds: 20, failure: .timeout)
            }
            manager.requestLocation()
        case .denied:
            finishWeatherLocation(failure: .denied)
        case .restricted:
            finishWeatherLocation(failure: .restricted)
        @unknown default:
            finishWeatherLocation()
        }
    }

    private func armWeatherLocationTimeout(requestID: String, seconds: TimeInterval,
                                          failure: WeatherLocationFailure) {
        weatherLocationTimer?.invalidate()
        weatherLocationTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
            guard let self, self.weatherLocationRequestID == requestID else { return }
            self.finishWeatherLocation(failure: failure)
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        continueWeatherLocation(manager)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard manager === weatherLocationManager,
              let location = locations.last(where: {
                  $0.horizontalAccuracy >= 0 && abs($0.timestamp.timeIntervalSinceNow) <= 30 * 60
                      && CLLocationCoordinate2DIsValid($0.coordinate)
              }) else { return }
        finishWeatherLocation(coordinate: location.coordinate)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard manager === weatherLocationManager else { return }
        let reason: WeatherLocationFailure = (error as? CLError)?.code == .denied ? .denied : .unavailable
        finishWeatherLocation(failure: reason)
    }

    private func finishWeatherLocation(coordinate: CLLocationCoordinate2D? = nil,
                                       failure: WeatherLocationFailure = .unavailable) {
        guard let requestID = weatherLocationRequestID else { return }
        var detail: [String: Any] = ["requestId": requestID]
        if let coordinate {
            // Only the approximate weather area crosses into the web application.
            detail["latitude"] = (coordinate.latitude * 100).rounded() / 100
            detail["longitude"] = (coordinate.longitude * 100).rounded() / 100
        } else {
            detail["errorCode"] = failure.rawValue
        }
        cancelWeatherLocation()
        guard let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('platop:location', {detail: \(json)}));",
                                   completionHandler: nil)
    }

    private func cancelWeatherLocation() {
        weatherLocationTimer?.invalidate()
        weatherLocationTimer = nil
        weatherLocationManager?.delegate = nil
        weatherLocationManager?.stopUpdatingLocation()
        weatherLocationManager = nil
        weatherLocationRequestID = nil
        locationAuthorizationRequested = false
        locationFixStarted = false
        locationServicesChecked = false
        restoreWeatherLocationWindowLevel()
    }

    private func restoreWeatherLocationWindowLevel() {
        guard locationAuthorizationLoweredWindow else { return }
        locationAuthorizationLoweredWindow = false
        if !window.styleMask.contains(.fullScreen) { window.level = interactiveWindowLevel }
    }

    @objc private func reloadPlayground(_ sender: Any?) {
        offlineView.isHidden = true
        webView.load(URLRequest(url: address.url, cachePolicy: .reloadIgnoringLocalCacheData,
                                timeoutInterval: 8))
    }

    @objc private func hidePlayground(_ sender: Any?) {
        publishVisibility(visible: false)
        renderWindow?.orderOut(nil)
    }

    @objc private func minimize(_ sender: Any?) {
        if desktopMode { showPlayground(nil) }
        window.miniaturize(nil)
    }
    @objc private func quit(_ sender: Any?) { NSApp.terminate(nil) }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        hidePlayground(nil)
        return false
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationWillTerminate(_ notification: Notification) {
        cancelWeatherLocation()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "platop")
        NotificationCenter.default.removeObserver(self)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showPlayground(nil)
        return true
    }

    func applicationDidHide(_ notification: Notification) { publishVisibility(visible: false) }
    func applicationDidUnhide(_ notification: Notification) { publishVisibility() }
    func windowDidMiniaturize(_ notification: Notification) { publishVisibility(visible: false) }
    func windowDidDeminiaturize(_ notification: Notification) { publishVisibility() }
    func windowDidChangeOcclusionState(_ notification: Notification) { publishVisibility() }
    func windowWillEnterFullScreen(_ notification: Notification) {
        fullscreenTransitioning = true
        // This also covers the system green button, which bypasses our menu action.
        window.level = .normal
    }
    func windowWillExitFullScreen(_ notification: Notification) { fullscreenTransitioning = true }
    func windowDidEnterFullScreen(_ notification: Notification) {
        fullscreenTransitioning = false
        updateModeMenus()
        publishNativeState()
        publishVisibility(force: true)
    }
    func windowDidExitFullScreen(_ notification: Notification) {
        fullscreenTransitioning = false
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenPrimary]
        window.level = interactiveWindowLevel
        if desktopAfterFullscreen {
            desktopAfterFullscreen = false
            enterDesktop()
        } else {
            updateModeMenus()
            publishNativeState()
            publishVisibility(force: true)
        }
    }
    func windowDidFailToEnterFullScreen(_ window: NSWindow) {
        fullscreenTransitioning = false
        window.level = interactiveWindowLevel
        updateModeMenus()
    }
    func windowDidFailToExitFullScreen(_ window: NSWindow) {
        fullscreenTransitioning = false
        desktopAfterFullscreen = false
        updateModeMenus()
    }

    private func publishVisibility(visible: Bool? = nil, force: Bool = false) {
        guard let renderedWindow = renderWindow, webView != nil else { return }
        let isVisible = visible ?? (renderedWindow.isVisible && !renderedWindow.isMiniaturized && !NSApp.isHidden
                                     && offlineView?.isHidden != false
                                     && renderedWindow.occlusionState.contains(.visible))
        guard force || lastVisibility != isVisible else { return }
        lastVisibility = isVisible
        let literal = isVisible ? "true" : "false"
        webView.evaluateJavaScript("""
            window.__PLATOP_DESKTOP_VISIBLE__ = \(literal);
            window.dispatchEvent(new CustomEvent('platop:visibility', {detail: {visible: \(literal)}}));
            """, completionHandler: nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Never hand untrusted links to another app. The companion can navigate
        // only to this bridge's loopback port; popups and external sites stay shut.
        guard navigationAction.targetFrame != nil,
              address.allows(navigationAction.request.url) else {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard address.allows(navigationResponse.response.url) else {
            decisionHandler(.cancel)
            return
        }
        if navigationResponse.isForMainFrame,
           let response = navigationResponse.response as? HTTPURLResponse,
           !(200...299).contains(response.statusCode) {
            decisionHandler(.cancel)
            showOffline("The local playground returned an error. Restart it with npm run desktop, then try again.")
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        offlineView.isHidden = true
        publishNativeState()
        publishVisibility(force: true)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        cancelWeatherLocation()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) { handleNavigationError(error) }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleNavigationError(error)
    }

    private func handleNavigationError(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        let endpoint = "\(address.url.host ?? "127.0.0.1"):\(address.port)"
        showOffline("PLaTOP could not reach the local playground at \(endpoint).\nStart it with npm run desktop, then try again.")
    }

    private func showOffline(_ message: String) {
        offlineMessage.stringValue = message
        offlineView.isHidden = false
        publishVisibility(visible: false)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showOffline("The playground view paused unexpectedly. Try waking it up again.")
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        nil
    }
}

let arguments = Array(CommandLine.arguments.dropFirst())
if arguments.first == "--validate-url" {
    guard arguments.count == 2, let address = PlaygroundAddress(arguments[1]) else {
        fputs("PLaTOP requires an HTTP localhost or 127.0.0.1 URL without credentials.\n", stderr)
        exit(2)
    }
    print(address.url.absoluteString)
    exit(0)
}

var requestedURL = "http://127.0.0.1:4317"
if let index = arguments.firstIndex(of: "--url") {
    guard arguments.indices.contains(index + 1) else {
        fputs("PLaTOP: --url requires a local URL.\n", stderr)
        exit(2)
    }
    requestedURL = arguments[index + 1]
}
guard let address = PlaygroundAddress(requestedURL) else {
    fputs("PLaTOP requires an HTTP localhost or 127.0.0.1 URL without credentials.\n", stderr)
    exit(2)
}
let app = NSApplication.shared
let delegate = PlaygroundDelegate(address: address)
app.delegate = delegate
app.run()
