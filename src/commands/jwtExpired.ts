/**
 * 解析JWT Token并判断是否过期
 * @param token JWT令牌字符串
 * @returns boolean - true表示已过期，false表示未过期
 * @throws {Error} 当token格式错误、解析失败或缺少exp字段时抛出异常
 */
const isJwtExpired = (token: string): boolean => {
    // 空值校验
    if (!token || typeof token !== 'string') {
        return true;
    }

    try {
        // 分割JWT的header.payload.signature三部分
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('无效的JWT令牌：格式不正确，必须包含三个部分');
        }

        // 解码payload部分（Base64Url解码）
        const payloadBase64 = parts[1];
        // 处理Base64填充问题
        const paddedPayload = payloadBase64.padEnd(payloadBase64.length + (4 - payloadBase64.length % 4) % 4, '=');

        // 解码并解析JSON
        const decodedPayload = atob(paddedPayload);
        const payload = JSON.parse(decodedPayload) as { exp?: number };

        // 检查是否包含exp字段
        if (typeof payload.exp !== 'number') {
            throw new Error('JWT令牌缺少过期时间（exp）字段');
        }

        // 获取当前时间戳（秒级，JWT的exp是秒级）
        const currentTime = Math.floor(Date.now() / 1000);


        return currentTime > payload.exp;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`解析JWT失败：${error.message}`);
        }
        throw new Error('解析JWT时发生未知错误');
    }
};

// 默认导出
export default isJwtExpired;