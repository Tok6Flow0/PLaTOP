import AppKit
import WebKit

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

final class PlaygroundDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate,
    WKNavigationDelegate, WKUIDelegate {
    private let address: PlaygroundAddress
    private var window: NSWindow!
    private var webView: WKWebView!
    private var offlineView: NSView!
    private var offlineMessage: NSTextField!
    private var statusItem: NSStatusItem!
    private var floatMenuItems: [NSMenuItem] = []
    private var lastVisibility: Bool?
    private var floating: Bool

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

    private func buildMenus() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "PLaTOP")
        appMenu.addItem(menuItem("Open Playground", action: #selector(showPlayground(_:)), key: "o"))
        appMenu.addItem(floatItem())
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
        windowItem.submenu = windowMenu
        mainMenu.addItem(windowItem)
        NSApp.mainMenu = mainMenu
        NSApp.windowsMenu = windowMenu
    }

    private func buildWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1000, height: 720),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "PLaTOP"
        window.contentMinSize = NSSize(width: 440, height: 420)
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.delegate = self
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.level = floating ? .floating : .normal
        window.setFrameAutosaveName("PLaTOP.Playground")
        window.center()

        let configuration = WKWebViewConfiguration()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__PLATOP_DESKTOP_VISIBLE__ = true;",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.translatesAutoresizingMaskIntoConstraints = false

        let content = NSView()
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
        menu.addItem(.separator())
        menu.addItem(menuItem("Quit PLaTOP", action: #selector(quit(_:))))
        statusItem.menu = menu
    }

    @objc private func showPlayground(_ sender: Any?) {
        NSApp.unhide(nil)
        if window.isMiniaturized { window.deminiaturize(nil) }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        publishVisibility()
    }

    @objc private func toggleFloat(_ sender: Any?) {
        floating.toggle()
        UserDefaults.standard.set(floating, forKey: "floatWindow")
        window.level = floating ? .floating : .normal
        for item in floatMenuItems { item.state = floating ? .on : .off }
    }

    @objc private func reloadPlayground(_ sender: Any?) {
        offlineView.isHidden = true
        webView.load(URLRequest(url: address.url, cachePolicy: .reloadIgnoringLocalCacheData,
                                timeoutInterval: 8))
    }

    @objc private func hidePlayground(_ sender: Any?) {
        publishVisibility(visible: false)
        window.orderOut(nil)
    }

    @objc private func minimize(_ sender: Any?) { window.miniaturize(nil) }
    @objc private func quit(_ sender: Any?) { NSApp.terminate(nil) }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        hidePlayground(nil)
        return false
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showPlayground(nil)
        return true
    }

    func applicationDidHide(_ notification: Notification) { publishVisibility(visible: false) }
    func applicationDidUnhide(_ notification: Notification) { publishVisibility() }
    func windowDidMiniaturize(_ notification: Notification) { publishVisibility(visible: false) }
    func windowDidDeminiaturize(_ notification: Notification) { publishVisibility() }
    func windowDidChangeOcclusionState(_ notification: Notification) { publishVisibility() }

    private func publishVisibility(visible: Bool? = nil, force: Bool = false) {
        guard window != nil, webView != nil else { return }
        let isVisible = visible ?? (window.isVisible && !window.isMiniaturized && !NSApp.isHidden
                                     && offlineView?.isHidden != false
                                     && window.occlusionState.contains(.visible))
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
        publishVisibility(force: true)
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
