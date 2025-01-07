import * as vscode from 'vscode';
import { CreateOptionName, JoinOptionName, QuitOptionName, StartOption } from './constant';
import { RepoEditor } from './editor/repoEditor';
import { ClientRepo } from './entity/clientRepo';
import { WebSocketConnection } from './connection/websocketConnection';
import { WebSocket } from 'ws';
import * as fsUtils from './util/fs';

// 定义用户输入的数据结构，包含操作类型、服务器地址、用户ID和仓库ID
export type UserInput = {
	option: StartOption;
	serverAddress: string;
	userId: string;
	repoId: string;
}

// 扩展主类，继承自 vscode.Disposable 以支持资源释放
class Extension extends vscode.Disposable {
	// 存储所有需要释放的资源
	private disposables: vscode.Disposable[] = [];
	
	// 编辑器实例
	private repoEditor?: RepoEditor;
	
	// 客户端仓库实例
	private clientRepo?: ClientRepo;
	
	// VSCode 状态栏项
	private statusBarItem!: vscode.StatusBarItem;

	// 获取当前连接状态
	get status() {
		return this.clientRepo?.connectionStatus ?? WebSocket.CLOSED;
	}

	// 构造函数，初始化状态栏
	constructor(statusBarItem: vscode.StatusBarItem) {
		super(() => this.disposables.forEach(item => item.dispose()));
		this.disposables.push(statusBarItem);
		this.statusBarItem = statusBarItem;
		this.statusBarItem && this.disposables.push(this.statusBarItem);
		statusBarItem.show();
	}

	// 扩展启动入口函数
	start = async () => {
		let userInput = await this.getUserInput();
		if (userInput) {
			console.log(userInput);
			if (userInput.option === StartOption.Create || userInput.option === StartOption.Join) {
				await this.connectRepo(userInput);
			}
			else {
				await this.leaveRepo();
			}
		}
		else {
			console.log('停止输入');
		}
	};

	// 获取用户输入的所有必要信息
	private async getUserInput() {
		let userInput: UserInput = {
			option: StartOption.Other,
			serverAddress: '',
			userId: '',
			repoId: ''
		};

		// 根据当前状态提供不同的选项
		let options = [];
		if (this.status === WebSocket.OPEN) {
			options = [QuitOptionName];
		}
		else if (this.status === WebSocket.CLOSED) {
			options = [CreateOptionName, JoinOptionName];
		}
		else {
			return;
		}

		// 获取用户选择的操作类型
		let selected = await vscode.window.showQuickPick(options);
		switch (selected) {
			case CreateOptionName:
				userInput.option = StartOption.Create;
				if (!(await this.checkWorkSpaceRoot(userInput))) {
					return;
				}
				break;
			case JoinOptionName:
				userInput.option = StartOption.Join;
				if (!(await this.checkWorkSpaceRoot(userInput))) {
					return;
				}
				break;
			case QuitOptionName:
				userInput.option = StartOption.Quit;
				return userInput;
			default:
				return;
		};

		// 验证并获取服务器地址
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

		// 获取用户ID
		let userId = await vscode.window.showInputBox({
			placeHolder: '请输入用户ID',
		});
		if (userId) {
			userInput.userId = userId;
		}
		else {
			return;
		}

		// 获取仓库ID
		let repoId = await vscode.window.showInputBox({
			placeHolder: '请输入仓库ID',
		});
		if (repoId) {
			userInput.repoId = repoId;
		}
		else {
			return;
		}

		return userInput;
	}

	// 连接到远程仓库
	private async connectRepo(userInput: UserInput) {
		if (!await WebSocketConnection.checkWebSocketConnection(userInput.serverAddress)) {
			return;
		}
		this.repoEditor = new RepoEditor(this.statusBarItem, vscode.workspace.workspaceFolders![0].uri.fsPath);
		this.clientRepo = new ClientRepo(userInput, this.repoEditor);
		await this.clientRepo.connectRepo(userInput.option === StartOption.Create);
	}

	// 离开当前仓库
	private async leaveRepo() {
		await this.clientRepo?.closeRepo();
		this.clientRepo = undefined;
		this.repoEditor = undefined;
	}

	// 检查工作区根目录是否符合要求
	private async checkWorkSpaceRoot(userInput: UserInput) {
		// 创建仓库时的检查
		if (userInput.option === StartOption.Create) {
			if (vscode.workspace.workspaceFolders?.length !== 1) {
				vscode.window.showErrorMessage('创建仓库时，工作区只能有一个文件夹');
				return false;
			}
			if ((await fsUtils.isDirEmpty(vscode.workspace.workspaceFolders[0]!.uri.fsPath))) {
				vscode.window.showErrorMessage("当前文件夹为空，请先为其创建文件");
				return false;
			}
		}

		// 加入仓库时的检查
		if (userInput.option === StartOption.Join) {
			if (vscode.workspace.workspaceFolders?.length !== 1) {
				vscode.window.showErrorMessage('创建仓库时，工作区只能有一个文件夹');
				return false;
			}
			if (!(await fsUtils.isDirEmpty(vscode.workspace.workspaceFolders[0]!.uri.fsPath))) {
				const choice = await vscode.window.showInformationMessage(
					"当前文件夹并不是空的, 您希望将当前文件夹清空吗（不清空将导致仓库克隆出错）?",
					"是",
					"否")
				if (choice === "是") {
					await fsUtils.emptyDir(vscode.workspace.workspaceFolders[0]!.uri.fsPath);
					await vscode.workspace.textDocuments.forEach(async (doc) => {
						if (!doc.isClosed) {
							await vscode.window.showTextDocument(doc);
							await vscode.commands.executeCommand(
								"workbench.action.closeActiveEditor"
							);
						}
					});
				} else {
					vscode.window.showWarningMessage(
						"你的文件夹必须是空文件夹，否则将导致仓库克隆出错"
					);
					return false;
				}
			}
		}
		return true;
	}
}

// VSCode 扩展激活入口点
export function activate(context: vscode.ExtensionContext) {
	// 创建状态栏按钮
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.text = '协同编程';
	statusBarItem.command = 'covscodeclient.start';

	// 初始化扩展实例
	const extension = new Extension(statusBarItem);
	context.subscriptions.push(extension);
	context.subscriptions.push(vscode.commands.registerCommand("covscodeclient.start", extension.start));
}

// VSCode 扩展停用入口点
export function deactivate() { }
