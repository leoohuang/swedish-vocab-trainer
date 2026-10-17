import assets from 'virtual:ord-assets';
import { createWorkerHandler } from './handler';
const handler = createWorkerHandler(assets);
export default { fetch: handler };
