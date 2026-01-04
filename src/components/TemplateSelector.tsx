import React, { useState } from 'react';
import { Card, List, Button, Badge, Typography, Modal, Input, Select, Slider, Space, Tag } from 'antd';
import { 
  PictureOutlined, 
  UserOutlined, 
  FileTextOutlined, 
  CloudOutlined,
  PaletteOutlined,
  PlusOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useAppStore } from '../stores/appStore';
import { Template } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const categoryIcons = {
  portrait: <UserOutlined />,
  product: <PictureOutlined />,
  document: <FileTextOutlined />,
  landscape: <CloudOutlined />,
  artistic: <PaletteOutlined />
};

const categoryColors = {
  portrait: 'blue',
  product: 'green',
  document: 'orange',
  landscape: 'cyan',
  artistic: 'purple'
};

const TemplateSelector: React.FC = () => {
  const { 
    templates, 
    selectedTemplateId, 
    setSelectedTemplateId,
    addTemplate,
    updateTemplate 
  } = useAppStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<Partial<Template>>({
    name: '',
    description: '',
    category: 'portrait',
    prompt: '',
    negativePrompt: '',
    params: {
      strength: 0.8,
      guidanceScale: 7.5,
      steps: 20,
      resolution: '1024x1024',
      quality: 'balanced'
    }
  });

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: 'portrait',
      prompt: '',
      negativePrompt: '',
      params: {
        strength: 0.8,
        guidanceScale: 7.5,
        steps: 20,
        resolution: '1024x1024',
        quality: 'balanced'
      }
    });
    setShowCreateModal(true);
  };

  const handleEditTemplate = (template: Template) => {
    if (template.isBuiltIn) return; // 内置模板不可编辑
    
    setEditingTemplate(template);
    setFormData({
      ...template,
      params: { ...template.params }
    });
    setShowCreateModal(true);
  };

  const handleSaveTemplate = () => {
    if (!formData.name || !formData.prompt) {
      return;
    }

    if (editingTemplate) {
      // 更新模板
      updateTemplate(editingTemplate.id, formData as Template);
    } else {
      // 创建新模板
      const newTemplate: Template = {
        id: `custom_${Date.now()}`,
        name: formData.name!,
        description: formData.description || '',
        category: formData.category as Template['category'],
        prompt: formData.prompt!,
        negativePrompt: formData.negativePrompt || '',
        params: formData.params!,
        isBuiltIn: false,
        createdAt: new Date()
      };
      addTemplate(newTemplate);
    }

    setShowCreateModal(false);
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>模板选择</span>
          <Button 
            size="small" 
            icon={<PlusOutlined />} 
            onClick={handleCreateTemplate}
          >
            新建
          </Button>
        </div>
      } 
      size="small"
    >
      <div style={{ marginBottom: 16 }}>
        {selectedTemplate && (
          <div style={{ 
            padding: 12, 
            background: '#f0f2f5', 
            borderRadius: 6,
            marginBottom: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {categoryIcons[selectedTemplate.category]}
              <Text strong>{selectedTemplate.name}</Text>
              <Tag color={categoryColors[selectedTemplate.category]}>
                {selectedTemplate.category}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedTemplate.description}
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text code style={{ fontSize: 11 }}>
                {selectedTemplate.prompt.substring(0, 100)}
                {selectedTemplate.prompt.length > 100 ? '...' : ''}
              </Text>
            </div>
          </div>
        )}
      </div>

      <List
        size="small"
        dataSource={templates}
        renderItem={(template) => (
          <List.Item
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              background: selectedTemplateId === template.id ? '#e6f7ff' : 'transparent',
              borderRadius: 6,
              marginBottom: 4,
              border: selectedTemplateId === template.id ? '1px solid #1890ff' : '1px solid transparent'
            }}
            onClick={() => setSelectedTemplateId(template.id)}
          >
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {categoryIcons[template.category]}
                  <Text>{template.name}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {template.isBuiltIn && (
                    <Tag color="blue" size="small">内置</Tag>
                  )}
                  {!template.isBuiltIn && (
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTemplate(template);
                      }}
                    />
                  )}
                </div>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {template.description}
              </Text>
            </div>
          </List.Item>
        )}
      />

      {/* 创建/编辑模板模态框 */}
      <Modal
        title={editingTemplate ? '编辑模板' : '创建模板'}
        open={showCreateModal}
        onOk={handleSaveTemplate}
        onCancel={() => setShowCreateModal(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>模板名称</Text>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入模板名称"
              style={{ marginTop: 4 }}
            />
          </div>

          <div>
            <Text strong>描述</Text>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="输入模板描述"
              style={{ marginTop: 4 }}
            />
          </div>

          <div>
            <Text strong>分类</Text>
            <Select
              value={formData.category}
              onChange={(value) => setFormData({ ...formData, category: value })}
              style={{ width: '100%', marginTop: 4 }}
            >
              <Select.Option value="portrait">
                <UserOutlined /> 人像
              </Select.Option>
              <Select.Option value="product">
                <PictureOutlined /> 产品
              </Select.Option>
              <Select.Option value="document">
                <FileTextOutlined /> 文档
              </Select.Option>
              <Select.Option value="landscape">
                <CloudOutlined /> 风景
              </Select.Option>
              <Select.Option value="artistic">
                <PaletteOutlined /> 艺术
              </Select.Option>
            </Select>
          </div>

          <div>
            <Text strong>提示词 (Prompt)</Text>
            <TextArea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              placeholder="输入AI提示词"
              rows={3}
              style={{ marginTop: 4 }}
            />
          </div>

          <div>
            <Text strong>负面提示词 (Negative Prompt)</Text>
            <TextArea
              value={formData.negativePrompt}
              onChange={(e) => setFormData({ ...formData, negativePrompt: e.target.value })}
              placeholder="输入负面提示词（可选）"
              rows={2}
              style={{ marginTop: 4 }}
            />
          </div>

          <div>
            <Text strong>参数设置</Text>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              <div>
                <Text>处理强度: {formData.params?.strength}</Text>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={formData.params?.strength}
                  onChange={(value) => setFormData({
                    ...formData,
                    params: { ...formData.params!, strength: value }
                  })}
                />
              </div>

              <div>
                <Text>引导比例: {formData.params?.guidanceScale}</Text>
                <Slider
                  min={1}
                  max={20}
                  step={0.5}
                  value={formData.params?.guidanceScale}
                  onChange={(value) => setFormData({
                    ...formData,
                    params: { ...formData.params!, guidanceScale: value }
                  })}
                />
              </div>

              <div>
                <Text>推理步数: {formData.params?.steps}</Text>
                <Slider
                  min={10}
                  max={50}
                  step={5}
                  value={formData.params?.steps}
                  onChange={(value) => setFormData({
                    ...formData,
                    params: { ...formData.params!, steps: value }
                  })}
                />
              </div>

              <div>
                <Text strong>分辨率</Text>
                <Select
                  value={formData.params?.resolution}
                  onChange={(value) => setFormData({
                    ...formData,
                    params: { ...formData.params!, resolution: value }
                  })}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <Select.Option value="512x512">512x512 (快速)</Select.Option>
                  <Select.Option value="1024x1024">1024x1024 (标准)</Select.Option>
                  <Select.Option value="1920x1080">1920x1080 (高清)</Select.Option>
                  <Select.Option value="2560x1440">2560x1440 (超高清)</Select.Option>
                </Select>
              </div>

              <div>
                <Text strong>质量</Text>
                <Select
                  value={formData.params?.quality}
                  onChange={(value) => setFormData({
                    ...formData,
                    params: { ...formData.params!, quality: value }
                  })}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <Select.Option value="fast">快速 (低质量)</Select.Option>
                  <Select.Option value="balanced">平衡 (标准质量)</Select.Option>
                  <Select.Option value="high">高质量</Select.Option>
                </Select>
              </div>
            </Space>
          </div>
        </Space>
      </Modal>
    </Card>
  );
};

export default TemplateSelector;