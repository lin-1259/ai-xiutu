import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Form, Input, Switch, Select, Button, Space, Alert, message } from 'antd';
import { 
  SettingOutlined, 
  ApiOutlined, 
  FolderOutlined, 
  BellOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useAppStore } from '../stores/appStore';

const { TabPane } = Tabs;
const { TextArea } = Input;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { config, setConfig } = useAppStore();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (visible) {
      form.setFieldsValue(config);
    }
  }, [visible, config, form]);

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

  const handleTestApi = async (provider: 'doubao' | 'gemini') => {
    try {
      message.loading('测试API连接中...', 0);
      
      if (window.electronAPI) {
        const result = await window.electronAPI.testProvider?.(provider);
        
        if (result) {
          message.success(`${provider === 'doubao' ? '豆包' : 'Google Gemini'} API连接成功`);
        } else {
          message.error(`${provider === 'doubao' ? '豆包' : 'Google Gemini'} API连接失败`);
        }
      }
    } catch (error) {
      message.error('API测试失败');
    } finally {
      message.destroy();
    }
  };

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
        <Form form={form} layout="vertical" initialValues={config}>
          <Alert
            message="API密钥安全说明"
            description="您的API密钥将安全地存储在本地，不会上传到任何服务器。请妥善保管您的API密钥。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item label="豆包API密钥" name={['api', 'doubao', 'apiKey']}>
            <Input.Password placeholder="输入豆包API密钥" />
          </Form.Item>

          <Form.Item>
            <Button 
              onClick={() => handleTestApi('doubao')}
              style={{ marginBottom: 16 }}
            >
              测试豆包API
            </Button>
          </Form.Item>

          <Form.Item label="Google Gemini API密钥" name={['api', 'gemini', 'apiKey']}>
            <Input.Password placeholder="输入Google Gemini API密钥" />
          </Form.Item>

          <Form.Item>
            <Button onClick={() => handleTestApi('gemini')}>
              测试Google Gemini API
            </Button>
          </Form.Item>
        </Form>
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