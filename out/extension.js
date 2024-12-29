"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const constant_1 = require("./constant");
const repoEditor_1 = require("./editor/repoEditor");
const clientRepo_1 = require("./entity/clientRepo");
const websocketConnection_1 = __importDefault(require("./connection/websocketConnection"));
class Extension extends vscode.Disposable {
    disposables = [];
    repoEditor;
    clientRepo;
    //开始函数
    start = async () => {
        let userInput = await this.getUserInput();
        if (userInput) {
            console.log(userInput);
            if (userInput.option === constant_1.StartOption.Create || userInput.option === constant_1.StartOption.Join) {
                await this.connectRepo(userInput);
            }
        }
        else {
            console.log('停止输入');
        }
    };
    constructor(statusBarItem) {
        super(() => this.disposables.forEach(item => item.dispose()));
        this.disposables.push(statusBarItem);
        statusBarItem.show();
    }
    //提供文本框来获取用户输入数据
    async getUserInput() {
        //待返回的数据
        let userInput = {
            option: constant_1.StartOption.Other,
            serverAddress: '',
            userId: '',
            repoId: ''
        };
        let options = [];
        if (constant_1.currentStatus === constant_1.CurrentStatus.On) {
            options = [constant_1.QuitOptionName];
        }
        else {
            options = [constant_1.CreateOptionName, constant_1.JoinOptionName];
        }
        //获取操作选项
        let selected = await vscode.window.showQuickPick(options);
        switch (selected) {
            case constant_1.CreateOptionName:
                userInput.option = constant_1.StartOption.Create;
                break;
            case constant_1.JoinOptionName:
                userInput.option = constant_1.StartOption.Join;
                break;
            case constant_1.QuitOptionName:
                userInput.option = constant_1.StartOption.Quit;
                return userInput;
            default:
                return;
        }
        ;
        //获取服务器地址
        const wsUrlRegex = /^(wss?:\/\/)([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-zA-Z]+):([0-9]{1,5})$/;
        let serverAddress = await vscode.window.showInputBox({
            placeHolder: '请输入服务器地址',
            value: 'ws://127.0.0.1:3000',
            validateInput: value => (wsUrlRegex.test(value) ? undefined : '输入格式错误'),
        });
        if (serverAddress) {
            userInput.serverAddress = serverAddress;
        }
        else {
            return;
        }
        //获取用户ID
        let userId = await vscode.window.showInputBox({
            placeHolder: '请输入用户ID',
        });
        if (userId) {
            userInput.userId = userId;
        }
        else {
            return;
        }
        //获取仓库ID
        let repoId = await vscode.window.showInputBox({
            placeHolder: '请输入仓库ID',
        });
        if (repoId) {
            userInput.repoId = repoId;
        }
        else {
            return;
        }
        //返回获取的输入值
        return userInput;
    }
    async connectRepo(userInput) {
        if (!await websocketConnection_1.default.checkWebSocketConnection(userInput.serverAddress)) {
            return;
        }
        this.repoEditor = new repoEditor_1.RepoEditor();
        this.clientRepo = new clientRepo_1.ClientRepo(userInput.serverAddress, this.repoEditor);
        this.clientRepo.connectRepo(userInput.userId, userInput.repoId, userInput.option === constant_1.StartOption.Create);
    }
}
//插件起点函数
function activate(context) {
    //IDE底部启动插件的按钮
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = 'covscode';
    statusBarItem.command = 'covscodeclient.start';
    //初始化插件
    const extension = new Extension(statusBarItem);
    context.subscriptions.push(extension);
    context.subscriptions.push(vscode.commands.registerCommand("covscodeclient.start", extension.start));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map