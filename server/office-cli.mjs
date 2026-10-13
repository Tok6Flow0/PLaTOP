import { MAX_BODY_BYTES } from './protocol.mjs';
import { parseAction, parseDecoration, parseRoomStyle } from './office-protocol.mjs';

/** New Office CLI commands accept bounded inline JSON, never a file or program. */
export function parseOfficeCommand(command, args) {
  if (command === 'action' && (args.length === 2 || args.length === 3)) {
    const [teamId, kind, json] = args;
    let options = {};
    if (json !== undefined) {
      if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_BODY_BYTES) throw new Error('Invalid public office data.');
      options = JSON.parse(json);
      if (!options || typeof options !== 'object' || Array.isArray(options)
        || Object.keys(options).some(key => !['actorId', 'target', 'gesture'].includes(key))) throw new Error('Invalid public office data.');
    }
    return { name: 'platop_action', arguments: parseAction({ teamId, kind, ...options }) };
  }
  if (command === 'decorate' && args.length === 3) {
    const [teamId, slot, json] = args;
    if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_BODY_BYTES) throw new Error('Invalid public office data.');
    return { name: 'platop_decorate', arguments: parseDecoration({ teamId, slot, parts: JSON.parse(json) }) };
  }
  if (command === 'style' && args.length === 2) {
    const [teamId, json] = args;
    if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_BODY_BYTES) throw new Error('Invalid public office data.');
    const options = JSON.parse(json);
    if (!options || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some(key => !['palette', 'lighting', 'reset'].includes(key))) throw new Error('Invalid public office data.');
    return { name: 'platop_style', arguments: parseRoomStyle({ teamId, ...options }) };
  }
  throw new Error('Invalid public office data.');
}
