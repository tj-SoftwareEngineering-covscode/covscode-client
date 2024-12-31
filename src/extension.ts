import * as vscode from 'vscode';
import { CreateOptionName, JoinOptionName, QuitOptionName, StartOption } from './constant';
import { RepoEditor } from './editor/repoEditor';
import { ClientRepo } from './entity/clientRepo';
import { WebSocketConnection } from './connection/websocketConnection';
import { WebSocket } from 'ws';
//用户输入的数据结构
export type UserInput = {
	option:StartOption;
	serverAddress:string;
	userId:string;
	repoId:string;
}

class Extension extends vscode.Disposable{
	private disposables: vscode.Disposable[] = [];
	private repoEditor?: RepoEditor;
	private clientRepo?: ClientRepo;
	private statusBarItem!: vscode.StatusBarItem;

	//开始函数
	start = async () => {
		let userInput = await this.getUserInput();
		if(userInput){
			console.log(userInput);
			if(userInput.option === StartOption.Create || userInput.option === StartOption.Join) {
				await this.connectRepo(userInput);
			}
		}
		else{
			console.log('停止输入');
		}
	};

	get status(){
		return this.clientRepo?.connectionStatus??WebSocket.CLOSED;
	}

	constructor(statusBarItem: vscode.StatusBarItem){
		super(() => this.disposables.forEach(item => item.dispose()));
		this.disposables.push(statusBarItem);
		this.statusBarItem = statusBarItem;
		this.statusBarItem && this.disposables.push(this.statusBarItem);
		statusBarItem.show();
	}

	//提供文本框来获取用户输入数据
	private async getUserInput(){
		//待返回的数据
		let userInput:UserInput={
			option:StartOption.Other,
			serverAddress:'',
			userId:'',
			repoId:''
		};

		let options=[];
		if(this.status===WebSocket.OPEN){
			options = [QuitOptionName];
		}
		else if(this.status===WebSocket.CLOSED){
			options = [CreateOptionName, JoinOptionName];
		}
		else{
			return;
		}

		//获取操作选项
		let selected=await vscode.window.showQuickPick(options);
    	switch(selected){
			case CreateOptionName:
				userInput.option=StartOption.Create;
				break;
			case JoinOptionName:
				userInput.option=StartOption.Join;
				break;
			case QuitOptionName:
				userInput.option=StartOption.Quit;
				return userInput;
			default:
				return;
		};

		//获取服务器地址
		const wsUrlRegex = /^(wss?:\/\/)([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-zA-Z]+):([0-9]{1,5})$/;
		let serverAddress = await vscode.window.showInputBox({
			placeHolder: '请输入服务器地址',
			value: 'ws://127.0.0.1:3000',
			validateInput: value => (wsUrlRegex.test(value) ? undefined : '输入格式错误'),
		});
		if (serverAddress) {
			userInput.serverAddress=serverAddress;
		}
		else{
			return;
		}

		//获取用户ID
		let userId = await vscode.window.showInputBox({
			placeHolder: '请输入用户ID',
		});
		if (userId) {
			userInput.userId=userId;
		}
		else{
			return;
		}

		//获取仓库ID
		let repoId = await vscode.window.showInputBox({
			placeHolder: '请输入仓库ID',
		});
		if (repoId) {
			userInput.repoId=repoId;
		}
		else{
			return;
		}

		//返回获取的输入值
		return userInput;
	}

	private async connectRepo(userInput:UserInput) {
		if(!await WebSocketConnection.checkWebSocketConnection(userInput.serverAddress)) {
			return;
		}
		this.repoEditor = new RepoEditor(this.statusBarItem);
		this.clientRepo = new ClientRepo(userInput, this.repoEditor);
		this.clientRepo.connectRepo(userInput.option === StartOption.Create);
	}
}

//插件起点函数
export function activate(context: vscode.ExtensionContext) {
	//IDE底部启动插件的按钮
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.text = 'covscode';
	statusBarItem.command = 'covscodeclient.start';
	
	//初始化插件
	const extension = new Extension(statusBarItem);
	context.subscriptions.push(extension);
	context.subscriptions.push(vscode.commands.registerCommand("covscodeclient.start", extension.start));
}

export function deactivate() {}