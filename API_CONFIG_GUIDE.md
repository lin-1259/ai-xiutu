# 用户可配置API端点和模型功能说明

## 功能概述

现在您可以自由配置API地址、API Key和AI模型，支持基于New-API的各种AI模型接口。

## 主要功能

### 1. 支持的API提供商类型
- **豆包Seedream 4.0**：官方集成
- **Google Gemini 3 Pro**：官方集成  
- **自定义API**：支持基于New-API的任何服务

### 2. 自定义API配置

#### 支持的认证方式
- **Bearer Token**：标准Bearer认证
- **API Key**：直接API Key认证
- **自定义请求头**：完全自定义认证方式

#### 配置参数
- **显示名称**：便于识别的名称
- **提供商标识**：技术标识符
- **API端点地址**：完整的API服务地址
- **API密钥**：认证所需的密钥
- **模型名称**：要使用的AI模型
- **速率限制**：每秒最大请求数
- **重试设置**：失败重试次数和延迟

### 3. 常用New-API服务配置示例

#### 1. OpenAI兼容接口
```
显示名称：我的OpenAI
提供商标识：openai
API端点地址：https://your-api-domain.com/v1
API密钥：sk-your-api-key
模型名称：gpt-4
认证类型：Bearer Token
```

#### 2. Claude兼容接口
```
显示名称：我的Claude
提供商标识：claude
API端点地址：https://your-api-domain.com/v1
API密钥：your-api-key
模型名称：claude-3-sonnet
认证类型：Bearer Token
```

#### 3. 智谱AI接口
```
显示名称：我的GLM
提供商标识：zhipu
API端点地址：https://your-api-domain.com/v1
API密钥：your-api-key
模型名称：glm-4
认证类型：Bearer Token
```

## 使用方法

### 1. 打开设置
- 点击主界面右上角的设置按钮

### 2. 进入API设置
- 选择"API设置"标签页

### 3. 添加自定义API
- 点击"添加自定义API"按钮
- 填写所有必填字段
- 点击"保存"

### 4. 管理API提供商
- 查看所有已配置的API提供商
- 测试API连接
- 启用/禁用提供商
- 设置默认提供商
- 编辑或删除自定义提供商

## 安全说明

1. **本地存储**：所有API密钥安全存储在本地，不会上传到任何服务器
2. **加密存储**：配置数据经过加密处理
3. **权限控制**：只有授权用户可以访问配置

## 故障排除

### 1. API测试失败
- 检查API端点地址是否正确
- 验证API密钥是否有效
- 确认模型名称正确
- 检查网络连接

### 2. 认证错误
- 确认认证类型设置正确
- 检查API密钥格式
- 验证自定义请求头配置

### 3. 速率限制
- 调整速率限制参数
- 检查API服务商的使用限制
- 增加重试延迟时间

## 支持的AI模型

基于New-API的服务通常支持以下模型类型：
- **GPT系列**：gpt-3.5-turbo, gpt-4, gpt-4-turbo
- **Claude系列**：claude-3-haiku, claude-3-sonnet, claude-3-opus
- **国产模型**：glm-4, qwen-turbo, qwen-plus, qwen-max
- **文心一言**：ernie-bot, ernie-bot-turbo
- **通义千问**：qwen-turbo, qwen-plus, qwen-max

## 技术支持

如果遇到问题，请检查：
1. API服务商文档
2. New-API项目文档
3. 网络连接状态
4. API配额和限制

## 更新日志

### v1.0.0
- ✅ 支持自定义API端点
- ✅ 支持任意AI模型
- ✅ 支持多种认证方式
- ✅ 完整的配置管理界面
- ✅ API连接测试功能
- ✅ 安全的本地存储