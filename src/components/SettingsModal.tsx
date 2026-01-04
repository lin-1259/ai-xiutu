import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Switch, Select, Button, Space, Alert, message, Card, Table, Popconfirm, Tag } from 'antd';
import { 
  SettingOutlined, 
  ApiOutlined, 
  FolderOutlined, 
  BellOutlined,
  DollarOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TestTubeOutlined
} from '@ant-design/icons';
import { useAppStore } from '../stores/appStore';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { config, setConfig } = useAppStore();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');
  const [apiProviders, setApiProviders] = useState<any[]>([]);
  const [currentProvider, setCurrentProvider] = useState<any>(null);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [apiForm] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.setFieldsValue(config);
      loadApiProviders();
    }
  }, [visible, config, form]);

  const loadApiProviders = async () => {
    try {
      if (window.electronAPI) {
        const providers = await window.electronAPI.getAllApiProviders();
        const current = await window.electronAPI.getCurrentApiProvider();
        setApiProviders(providers);
        setCurrentProvider(current);
      }
    } catch (error) {
      console.error('加载API提供商失败:', error);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 保存配置到electron store
      if (window.electronAPI) {
        await window.electronAPI.setConfig('general', values.general);
        await window.electronAPI.setConfig('processing', values.processing);
        await window.electronAPI.setConfig('hotFolder', values.hotFolder);
        await window.electronAPI.setConfig('system', values.system);
        await window.electronAPI.setConfig('cost', values.cost);
      }

      // 更新本地状态
      Object.keys(values).forEach(section => {
        Object.keys(values[section]).forEach(key => {
          setConfig(`${section}.${key}`, values[section][key]);
        });
      });

      message.success('设置已保存');
      onClose();
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('保存设置失败');
    }
  };

  const handleTestApi = async (providerId: string) => {
    try {
      message.loading('测试API连接中...', 0);
      
      if (window.electronAPI) {
        const result = await window.electronAPI.testApiProvider(providerId);
        
        if (result) {
          message.success('API连接成功');
        } else {
          message.error('API连接失败');
        }
      }
    } catch (error) {
      message.error('API测试失败');
    } finally {
      message.destroy();
    }
  };

  const handleAddProvider = async () => {
    try {
      const values = await apiForm.validateFields();
      
      if (window.electronAPI) {
        const providerId = await window.electronAPI.addCustomApiProvider(values);
        message.success('API提供商添加成功');
        setIsAddingProvider(false);
        apiForm.resetFields();
        loadApiProviders();
      }
    } catch (error) {
      message.error('添加API提供商失败');
    }
  };

  const handleUpdateProvider = async (id: string) => {
    try {
      const values = await apiForm.validateFields();
      
      if (window.electronAPI) {
        await window.electronAPI.updateApiProvider(id, values);
        message.success('API提供商更新成功');
        setEditingProvider(null);
        apiForm.resetFields();
        loadApiProviders();
      }
    } catch (error) {
      message.error('更新API提供商失败');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.removeCustomApiProvider(id);
        message.success('API提供商已删除');
        loadApiProviders();
      }
    } catch (error) {
      message.error('删除API提供商失败');
    }
  };

  const handleSetCurrentProvider = async (id: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.setCurrentApiProvider(id);
        message.success('已切换默认API提供商');
        loadApiProviders();
      }
    } catch (error) {
      message.error('切换API提供商失败');
    }
  };

  const startEditProvider = (provider: any) => {
    setEditingProvider(provider);
    apiForm.setFieldsValue(provider);
  };

  const cancelEdit = () => {
    setEditingProvider(null);
    setIsAddingProvider(false);
    apiForm.resetFields();
  };

  const apiColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <div>{text}</div>
          {record.isCustom && <Tag size="small" color="blue">自定义</Tag>}
        </div>
      )
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider'
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record: any) => (
        <Space>
          <Tag color={record.enabled ? 'green' : 'red'}>
            {record.enabled ? '已启用' : '已禁用'}
          </Tag>
          {record.id === currentProvider?.id && <Tag color="blue">当前使用</Tag>}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: any) => (
        <Space>
          <Button 
            size="small" 
            icon={<TestTubeOutlined />} 
            onClick={() => handleTestApi(record.id)}
          >
            测试
          </Button>
          <Button 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => startEditProvider(record)}
          >
            编辑
          </Button>
          {record.isCustom && (
            <Popconfirm
              title="确定删除这个API提供商吗？"
              onConfirm={() => handleDeleteProvider(record.id)}
            >
              <Button 
                size="small" 
                danger 
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          )}
          {record.enabled && record.id !== currentProvider?.id && (
            <Button 
              size="small" 
              type="primary"
              onClick={() => handleSetCurrentProvider(record.id)}
            >
              设为默认
            </Button>
          )}
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'general',
      label: (
        <span>
          <SettingOutlined />
          常规设置
        </span>
      ),
      children: (
        <Form form={form} layout="vertical" initialValues={config}>
          <Form.Item label="主题" name={['general', 'theme']}>
            <Select>
              <Select.Option value="light">浅色</Select.Option>
              <Select.Option value="dark">深色</Select.Option>
              <Select.Option value="system">跟随系统</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="语言" name={['general', 'language']}>
            <Select>
              <Select.Option value="zh-CN">简体中文</Select.Option>
              <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="自动保存" name={['general', 'autoSave']} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="自动保存间隔(秒)" name={['general', 'autoSaveInterval']}>
            <Input type="number" min={30} max={3600} />
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'processing',
      label: (
        <span>
          <ApiOutlined />
          处理设置
        </span>
      ),
      children: (
        <Form form={form} layout="vertical" initialValues={config}>
          <Form.Item label="最大并发任务数" name={['processing', 'maxConcurrentTasks']}>
            <Input type="number" min={1} max={10} />
          </Form.Item>

          <Form.Item label="默认API提供商" name={['processing', 'defaultApiProvider']}>
            <Select>
              <Select.Option value="doubao">豆包 Seedream</Select.Option>
              <Select.Option value="gemini">Google Gemini</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="输出格式" name={['processing', 'outputFormat']}>
            <Select>
              <Select.Option value="jpg">JPG</Select.Option>
              <Select.Option value="png">PNG</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="图片质量" name={['processing', 'quality']}>
            <Input type="number" min={1} max={100} />
          </Form.Item>

          <Form.Item label="压缩级别" name={['processing', 'compressionLevel']}>
            <Input type="number" min={1} max={9} />
          </Form.Item>

          <Form.Item label="启用优化" name={['processing', 'enableOptimization']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'api',
      label: (
        <span>
          <ApiOutlined />
          API设置
        </span>
      ),
      children: (
        <div>
          <Alert
            message="API提供商管理"
            description="您可以添加自定义的API提供商，支持基于New-API的各种AI模型接口。所有配置将安全保存在本地。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 16 }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setIsAddingProvider(true)}
            >
              添加自定义API
            </Button>
          </div>

          <Table
            dataSource={apiProviders}
            columns={apiColumns}
            rowKey="id"
            pagination={false}
            size="small"
          />

          {/* 添加/编辑API提供商弹窗 */}
          <Modal
            title={editingProvider ? '编辑API提供商' : '添加API提供商'}
            open={isAddingProvider || !!editingProvider}
            onOk={editingProvider ? () => handleUpdateProvider(editingProvider.id) : handleAddProvider}
            onCancel={cancelEdit}
            width={600}
            okText="保存"
            cancelText="取消"
          >
            <Form form={apiForm} layout="vertical">
              <Form.Item
                label="显示名称"
                name="name"
                rules={[{ required: true, message: '请输入显示名称' }]}
              >
                <Input placeholder="例如：我的自定义API" />
              </Form.Item>

              <Form.Item
                label="提供商标识"
                name="provider"
                rules={[{ required: true, message: '请输入提供商标识' }]}
              >
                <Input placeholder="例如：custom, openai等" />
              </Form.Item>

              <Form.Item
                label="API端点地址"
                name="endpoint"
                rules={[{ required: true, message: '请输入API端点地址' }]}
              >
                <Input placeholder="例如：https://your-api-domain.com/v1" />
              </Form.Item>

              <Form.Item
                label="API密钥"
                name="apiKey"
                rules={[{ required: true, message: '请输入API密钥' }]}
              >
                <Input.Password placeholder="输入API密钥" />
              </Form.Item>

              <Form.Item
                label="模型名称"
                name="model"
                rules={[{ required: true, message: '请输入模型名称' }]}
              >
                <Input placeholder="例如：gpt-4, claude-3等" />
              </Form.Item>

              <Form.Item
                label="认证类型"
                name="authType"
                initialValue="bearer"
              >
                <Select>
                  <Option value="bearer">Bearer Token</Option>
                  <Option value="apikey">API Key</Option>
                  <Option value="header">自定义请求头</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="最大重试次数"
                name="maxRetries"
                initialValue={3}
              >
                <Input type="number" min={1} max={10} />
              </Form.Item>

              <Form.Item
                label="重试延迟(毫秒)"
                name="retryDelay"
                initialValue={1000}
              >
                <Input type="number" min={100} max={10000} />
              </Form.Item>

              <Form.Item
                label="速率限制(请求/秒)"
                name="rateLimit"
                initialValue={3}
              >
                <Input type="number" min={1} max={100} />
              </Form.Item>

              <Form.Item
                label="启用状态"
                name="enabled"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch />
              </Form.Item>

              <Form.Item label="自定义请求头" name="customHeaders">
                <TextArea 
                  placeholder="以JSON格式输入自定义请求头，例如：&#10;{&#10;  &quot;X-Custom-Header&quot;: &quot;value&quot;&#10;}"
                  rows={3}
                  onChange={(e) => {
                    // 尝试解析JSON
                    try {
                      const value = e.target.value;
                      if (value.trim()) {
                        JSON.parse(value);
                      }
                    } catch (error) {
                      // 如果JSON解析失败，可以在这里显示错误
                    }
                  }}
                />
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )
    },
    {
      key: 'hotFolder',
      label: (
        <span>
          <FolderOutlined />
          热文件夹
        </span>
      ),
      children: (
        <Form form={form} layout="vertical" initialValues={config}>
          <Form.Item label="启用热文件夹" name={['hotFolder', 'enabled']} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="输入目录" name={['hotFolder', 'inputPath']}>
            <Input placeholder="选择监控的文件夹" />
          </Form.Item>

          <Form.Item label="输出目录" name={['hotFolder', 'outputPath']}>
            <Input placeholder="选择输出文件夹" />
          </Form.Item>

          <Form.Item label="默认模板" name={['hotFolder', 'templateId']}>
            <Select>
              <Select.Option value="ecommerce-white-bg">电商白底图</Select.Option>
              <Select.Option value="portrait-beautify">人像美化</Select.Option>
              <Select.Option value="document-scan">文档扫描</Select.Option>
              <Select.Option value="landscape-enhance">风景增强</Select.Option>
              <Select.Option value="artistic-style">艺术风格</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="文件格式" name={['hotFolder', 'filePatterns']}>
            <Select mode="tags" placeholder="选择支持的文件格式">
              <Select.Option value="*.jpg">*.jpg</Select.Option>
              <Select.Option value="*.jpeg">*.jpeg</Select.Option>
              <Select.Option value="*.png">*.png</Select.Option>
              <Select.Option value="*.bmp">*.bmp</Select.Option>
              <Select.Option value="*.tiff">*.tiff</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="自动开始处理" name={['hotFolder', 'autoStart']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'system',
      label: (
        <span>
          <SettingOutlined />
          系统设置
        </span>
      ),
      children: (
        <Form form={form} layout="vertical" initialValues={config}>
          <Form.Item label="最小化到托盘" name={['system', 'minimizeToTray']} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="显示通知" name={['system', 'showNotifications']} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="关闭窗口到托盘" name={['system', 'closeToTray']} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="开机自启" name={['system', 'startOnBoot']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'cost',
      label: (
        <span>
          <DollarOutlined />
          成本控制
        </span>
      ),
      children: (
        <Form form={form} layout="vertical" initialValues={config}>
          <Alert
            message="成本控制说明"
            description="设置预算限制以避免超出预期的API费用支出。系统会在达到阈值时提醒您。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="每日预算(元)" name={['cost', 'dailyBudget']}>
            <Input type="number" min={0} />
          </Form.Item>

          <Form.Item label="每月预算(元)" name={['cost', 'monthlyBudget']}>
            <Input type="number" min={0} />
          </Form.Item>

          <Form.Item label="启用费用提醒" name={['cost', 'costAlertEnabled']} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="提醒阈值(%)" name={['cost', 'costAlertThreshold']}>
            <Input type="number" min={50} max={100} />
          </Form.Item>
        </Form>
      )
    }
  ];

  return (
    <Modal
      title="设置"
      open={visible}
      onOk={handleSave}
      onCancel={onClose}
      width={600}
      okText="保存"
      cancelText="取消"
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={tabItems}
      />
    </Modal>
  );
};

export default SettingsModal;