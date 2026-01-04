import React, { useCallback, useState } from 'react';
import { Upload, Button, Space, message, Card } from 'antd';
import { InboxOutlined, FolderOutlined } from '@ant-design/icons';
import { useAppStore } from '../stores/appStore';
import { ImageFile } from '../types';

const { Dragger } = Upload;

interface FileUploadProps {
  onFilesAdded?: (files: ImageFile[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesAdded }) => {
  const { addImages, setLoading } = useAppStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const processFiles = useCallback(async (fileList: FileList) => {
    const imageFiles: ImageFile[] = [];
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];

    setLoading(true);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        // 验证文件类型
        if (!validTypes.includes(file.type)) {
          message.warning(`跳过不支持的文件: ${file.name}`);
          continue;
        }

        // 验证文件大小 (最大 50MB)
        if (file.size > 50 * 1024 * 1024) {
          message.warning(`文件过大: ${file.name} (最大 50MB)`);
          continue;
        }

        try {
          // 创建图片对象URL用于预览
          const imageUrl = URL.createObjectURL(file);

          // 获取图片尺寸
          const dimensions = await getImageDimensions(imageUrl);

          const imageFile: ImageFile = {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            path: (file as any).path || file.name,
            size: file.size,
            width: dimensions.width,
            height: dimensions.height,
            format: file.type.split('/')[1].toUpperCase(),
            createdAt: new Date(),
            status: 'pending',
            progress: 0
          };

          imageFiles.push(imageFile);

        } catch (error) {
          message.error(`处理文件失败: ${file.name}`);
          console.error('File processing error:', error);
        }
      }

      if (imageFiles.length > 0) {
        addImages(imageFiles);
        onFilesAdded?.(imageFiles);
        message.success(`成功添加 ${imageFiles.length} 个文件`);
      }

    } catch (error) {
      message.error('批量处理文件失败');
      console.error('Batch file processing error:', error);
    } finally {
      setLoading(false);
    }
  }, [addImages, setLoading, onFilesAdded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  }, [processFiles]);

  const handleFolderSelect = useCallback(async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectFiles({
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          const imageFiles: ImageFile[] = [];
          
          for (const path of result.filePaths) {
            try {
              const info = await window.electronAPI.readImageInfo(path);
              const fileName = path.split(/[\\/]/).pop() || 'unknown';
              
              imageFiles.push({
                id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: fileName,
                path: path,
                size: info.size,
                width: info.width,
                height: info.height,
                format: info.format.toUpperCase(),
                createdAt: new Date(),
                status: 'pending',
                progress: 0
              });
            } catch (error) {
              console.error(`Failed to read info for ${path}:`, error);
            }
          }

          if (imageFiles.length > 0) {
            addImages(imageFiles);
            onFilesAdded?.(imageFiles);
            message.success(`成功添加 ${imageFiles.length} 个文件`);
          }
        }
      }
    } catch (error) {
      message.error('选择文件夹失败');
      console.error('Folder selection error:', error);
    }
  }, [addImages, onFilesAdded]);

  return (
    <Card title="文件上传" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 拖拽上传区域 */}
        <Dragger
          multiple
          showUploadList={false}
          beforeUpload={() => false}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          style={{
            border: isDragOver ? '2px dashed #1890ff' : '2px dashed #d9d9d9',
            borderRadius: 8,
            padding: '20px 10px',
            background: isDragOver ? '#e6f7ff' : '#fafafa',
            transition: 'all 0.3s'
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: isDragOver ? '#1890ff' : '#bfbfbf' }} />
          </p>
          <p className="ant-upload-text" style={{ 
            color: isDragOver ? '#1890ff' : '#666',
            fontWeight: 500
          }}>
            {isDragOver ? '松开鼠标添加文件' : '拖拽图片到此处，或点击上传'}
          </p>
          <p className="ant-upload-hint" style={{ color: '#999' }}>
            支持 JPG、PNG、BMP、TIFF 格式，单个文件最大 50MB
          </p>
        </Dragger>

        {/* 文件选择按钮 */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button 
            icon={<InboxOutlined />}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = 'image/*';
              input.onchange = handleFileInput;
              input.click();
            }}
          >
            选择文件
          </Button>

          <Button 
            icon={<FolderOutlined />}
            onClick={handleFolderSelect}
          >
            选择文件夹
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

// 获取图片尺寸的工具函数
const getImageDimensions = (imageUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(imageUrl); // 释放内存
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(imageUrl);
    };
    img.src = imageUrl;
  });
};

export default FileUpload;