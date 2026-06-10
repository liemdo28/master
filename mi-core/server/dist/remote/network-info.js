"use strict";
/**
 * Network Info — detect LAN IP, Tailscale IP, build remote URLs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNetworkInfo = getNetworkInfo;
exports.pingUrl = pingUrl;
const os_1 = __importDefault(require("os"));
const http_1 = __importDefault(require("http"));
function getNetworkInfo(port = 4001) {
    const ifaces = os_1.default.networkInterfaces();
    let lan_ip = null;
    let tailscale_ip = null;
    for (const [name, addrs] of Object.entries(ifaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            if (addr.family !== 'IPv4' || addr.internal)
                continue;
            // Tailscale uses 100.x.x.x range
            if (addr.address.startsWith('100.')) {
                tailscale_ip = addr.address;
                continue;
            }
            // LAN: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
            if (addr.address.startsWith('192.168.') ||
                addr.address.startsWith('10.') ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(addr.address)) {
                lan_ip = addr.address;
            }
        }
    }
    return {
        lan_ip,
        tailscale_ip,
        lan_url: lan_ip ? `http://${lan_ip}:${port}` : null,
        tailscale_url: tailscale_ip ? `http://${tailscale_ip}:${port}` : null,
        port,
    };
}
/** Quick async check if a URL responds */
function pingUrl(url, timeoutMs = 1500) {
    return new Promise(resolve => {
        try {
            const req = http_1.default.get(url, (res) => {
                resolve(res.statusCode !== undefined);
                req.destroy();
            });
            req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
            req.on('error', () => resolve(false));
        }
        catch {
            resolve(false);
        }
    });
}
