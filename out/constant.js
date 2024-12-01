"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuitOptionName = exports.JoinOptionName = exports.CreateOptionName = exports.StartOption = exports.currentStatus = exports.CurrentStatus = void 0;
var CurrentStatus;
(function (CurrentStatus) {
    CurrentStatus[CurrentStatus["On"] = 0] = "On";
    CurrentStatus[CurrentStatus["Off"] = 1] = "Off";
})(CurrentStatus || (exports.CurrentStatus = CurrentStatus = {}));
//当前插件的运行状态
exports.currentStatus = CurrentStatus.Off;
var StartOption;
(function (StartOption) {
    StartOption[StartOption["Create"] = 0] = "Create";
    StartOption[StartOption["Join"] = 1] = "Join";
    StartOption[StartOption["Quit"] = 2] = "Quit";
    StartOption[StartOption["Other"] = 3] = "Other";
})(StartOption || (exports.StartOption = StartOption = {}));
exports.CreateOptionName = '创建仓库';
exports.JoinOptionName = '加入仓库';
exports.QuitOptionName = '退出仓库';
//# sourceMappingURL=constant.js.map