import { Doc } from "sharedb"; // 引入 sharedb 库中的 Doc 类型，用于操作文档对象
import { ClientFile } from "../entity/clientFile"; // 引入 ClientFile 实体类，表示客户端文件
import { ClientRepo } from "../entity/clientRepo"; // 引入 ClientRepo 实体类，表示客户端仓库
 
/**
 * DocManager 类，用于管理文档对象（Doc）及其版本
 */
export class DocManager {
    // 静态私有成员，用于存储文档ID到文档对象的映射
    private static docMap: Map<string, Doc> = new Map();
 
    // 静态私有成员，用于存储文档对象到其版本的映射
    private static docVersionMap: Map<Doc, number> = new Map();
 
    /**
     * 清空所有存储的文档对象和版本信息
     */
    public static dataClear() {
        this.docMap.clear(); // 清空文档对象映射
        this.docVersionMap.clear(); // 清空文档版本映射
    }
 
    /**
     * 根据客户端文件信息获取对应的文档对象
     * @param clientFile 客户端文件信息
     * @returns 对应的文档对象，若不存在则返回 undefined
     */
    public static getDoc(clientFile: ClientFile) {
        const docId = clientFile.getClientRepo().getRepoId()! + clientFile.getRelativePath()!; // 拼接文档ID
        return this.docMap.get(docId!); // 根据文档ID获取文档对象
    }
 
    /**
     * 添加文档对象到映射中
     * @param clientFile 客户端文件信息
     * @param doc 文档对象
     */
    public static addDoc(clientFile: ClientFile, doc: Doc) {
        const docId = clientFile.getClientRepo().getRepoId()! + clientFile.getRelativePath()!; // 拼接文档ID
        this.docMap.set(docId!, doc); // 将文档对象添加到映射中
    }
 
    /**
     * 从映射中移除指定的文档对象
     * @param clientFile 客户端文件信息
     */
    public static removeDoc(clientFile: ClientFile) {
        const docId = clientFile.getClientRepo().getRepoId()! + clientFile.getRelativePath()!; // 拼接文档ID
        this.docMap.delete(docId); // 从映射中删除文档对象
    }
 
    /**
     * 根据客户端仓库信息获取对应的“游标”文档对象
     * @param clientRepo 客户端仓库信息
     * @returns 对应的“游标”文档对象，若不存在则返回 undefined
     */
    public static getRepoDoc(clientRepo: ClientRepo) {
        const key = clientRepo.getRepoId()! + "cursor"; // 拼接“游标”文档ID
        return this.docMap.get(key); // 根据“游标”文档ID获取文档对象
    }
 
    /**
     * 添加“游标”文档对象到映射中
     * @param clientRepo 客户端仓库信息
     * @param doc “游标”文档对象
     */
    public static addRepoDoc(clientRepo: ClientRepo, doc: Doc) {
        const key = clientRepo.getRepoId()! + "cursor"; // 拼接“游标”文档ID
        DocManager.docMap.set(key, doc); // 将“游标”文档对象添加到映射中
    }
 
    /**
     * 判断指定文档对象是否有最后一个版本信息
     * @param doc 文档对象
     * @returns 若有最后一个版本信息则返回 true，否则返回 false
     */
    public static hasLastVersion(doc: Doc) {
        return doc ? DocManager.docVersionMap.has(doc) : false; // 判断文档对象是否在版本映射中存在
    }
    
    /**
     * 获取指定文档对象的最后一个版本信息
     * @param doc 文档对象
     * @returns 最后一个版本信息，若不存在则返回 null
     */
    public static getLastVersion(doc: Doc) {
        return doc ? DocManager.docVersionMap.get(doc) || null : null; // 获取文档对象的版本信息，若不存在则返回 null
    }
    
    /**
     * 设置指定文档对象的最后一个版本信息
     * @param doc 文档对象
     */
    public static setLastVersion(doc: Doc) {
        if (doc) {
            DocManager.docVersionMap.set(doc, doc.version!); // 设置文档对象的版本信息
        }
    }
 
    /**
     * 清空所有存储的文档对象和版本信息的别名方法（与 dataClear 方法功能相同）
     */
    public static clear() {
        this.docMap.clear(); // 清空文档对象映射
        this.docVersionMap.clear(); // 清空文档版本映射
    }
}