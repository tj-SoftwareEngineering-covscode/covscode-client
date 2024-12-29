"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientRepo = void 0;
const websocketConnection_1 = __importDefault(require("../connection/websocketConnection"));
class ClientRepo {
    serverAddress;
    repoEditor;
    websocketConnection;
    constructor(serverAddress, repoEditor) {
        this.serverAddress = serverAddress;
        this.repoEditor = repoEditor;
        this.websocketConnection = new websocketConnection_1.default(this.serverAddress, 'websocket');
    }
    async connectRepo(userId, repoId, isNew) {
        this.websocketConnection.connect();
    }
}
exports.ClientRepo = ClientRepo;
//# sourceMappingURL=clientRepo.js.map