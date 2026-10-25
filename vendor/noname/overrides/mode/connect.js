/* GPL-3.0: same-origin transport for the upstream native online protocol. */
import { lib, game } from '../noname.js';
import { startRelay } from '../grail-online.js';
export const type = 'mode';
export default () => ({ name: 'connect', start() { lib.init.onfree(); game.grailStartRelay(); }, game: { grailStartRelay: startRelay } });
