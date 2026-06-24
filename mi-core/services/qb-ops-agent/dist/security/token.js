"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMachineToken = exports.getOrCreateMachineToken = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const encryption_1 = require("./encryption");
const logs_1 = require("../storage/logs");
const TOKEN_FILE = path_1.default.join(process.cwd(), '.machine_token');
function getOrCreateMachineToken() {
    if (fs_1.default.existsSync(TOKEN_FILE)) {
        const token = fs_1.default.readFileSync(TOKEN_FILE, 'utf8').trim();
        if (token)
            return token;
    }
    const token = process.env.MACHINE_TOKEN || (0, encryption_1.generateMachineToken)();
    fs_1.default.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
    logs_1.logger.info('Machine token generated and saved', { tokenFile: TOKEN_FILE });
    return token;
}
exports.getOrCreateMachineToken = getOrCreateMachineToken;
function getMachineToken() {
    if (process.env.MACHINE_TOKEN)
        return process.env.MACHINE_TOKEN;
    if (fs_1.default.existsSync(TOKEN_FILE))
        return fs_1.default.readFileSync(TOKEN_FILE, 'utf8').trim();
    return null;
}
exports.getMachineToken = getMachineToken;
//# sourceMappingURL=token.js.map