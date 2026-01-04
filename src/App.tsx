import React, { useEffect, useState } from 'react';
import { Layout, Button, Space, Badge, notification, Modal, message } from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  FolderOutlined,
  FileImageOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useAppStore } from './stores/appStore';
import FileUpload from './components/FileUpload';
import TaskList from './components/TaskList';
import TemplateSelector from './components/TemplateSelector';
import StatisticsPanel from './components/StatisticsPanel';
import SettingsModal from './components/SettingsModal';

const { Header, Content } = Layout;

const App: React.FC = () => {
  const {
    tasks,
    stats,
    isLoading,
    setLoading,
    updateTask,
    clearCompletedTasks,
    config
  } = useAppStore();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // 初始化监听
    if (window.electronAPI) {
      // 监听任务进度更新
      window.electronAPI.onTaskProgress((taskId: string, progress: any) => {
        updateTask(taskId, { 
          progress: progress.progress,
          status: progress.status || 'processing'
        });
      });

      // 监听任务完成
      window.electronAPI.onTaskCompleted((taskId: string, result: any) => {
        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          result: result
        });

        notification.success({
          message: '任务完成',
          description: `任务 ${taskId} 已成功完成`,
          placement: 'bottomRight'
        });
      });

      // 监听任务失败
      window.electronAPI.onTaskFailed((taskId: string, error: string) => {
        updateTask(taskId, {
          status: 'failed',
          error: error
        });

        notification.error({
          message: '任务失败',
          description: `任务 ${taskId} 处理失败: ${error}`,
          placement: 'bottomRight'
        });
      });

      // 监听热文件夹新文件
      window.electronAPI.onHotFolderNewFile((filePath: string) => {
        notification.info({
          message: '检测到新文件',
          description: `热文件夹检测到新文件: ${filePath}`,
          placement: 'bottomRight'
        });
      });

      // 监听显示设置
      window.electronAPI.onShowSettings(() => {
        setSettingsVisible(true);
      });
    }
  }, [updateTask]);

  const handleStartProcessing = async () => {
    if (tasks.length === 0) {
      message.warning('请先添加图片和选择模板');
      return;
    }

    const pendingTasks = tasks.filter(task => task.status === 'pending');
    if (pendingTasks.length === 0) {
      message.info('没有待处理的任务');
      return;
    }

    setIsProcessing(true);
    setLoading(true);

    try {
      // 向主进程发送开始处理请求
      for (const task of pendingTasks) {
        await window.electronAPI.addTask({
          id: task.id,
          imageId: task.imageId,
          templateId: task.templateId,
          priority: task.priority
        });
      }

      message.success(`已开始处理 ${pendingTasks.length} 个任务`);
    } catch (error) {
      console.error('启动处理失败:', error);
      message.error('启动处理失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseProcessing = () => {
    setIsProcessing(false);
    message.info('已暂停处理');
  };

  const handleClearCompleted = () => {
    Modal.confirm({
      title: '确认清除',
      content: '确定要清除所有已完成的任务吗？',
      onOk: () => {
        clearCompletedTasks();
        message.success('已清除已完成的任务');
      }
    });
  };

  const showStats = () => {
    Modal.info({
      title: '处理统计',
      width: 600,
      content: (
        <StatisticsPanel 
          stats={stats} 
          tasks={tasks}
        />
      )
    });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <FileImageOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>
            AI批量修图助手
          </h1>
        </div>

        <Space size="middle">
          <Badge count={stats.totalTasks} showZero>
            <Button 
              icon={<PlayCircleOutlined />} 
              onClick={showStats}
            >
              统计
            </Button>
          </Badge>

          {isProcessing ? (
            <Button 
              icon={<PauseCircleOutlined />} 
              onClick={handlePauseProcessing}
              loading={isLoading}
            >
              暂停处理
            </Button>
          ) : (
            <Button 
              type="primary"
              icon={<PlayCircleOutlined />} 
              onClick={handleStartProcessing}
              loading={isLoading}
              disabled={tasks.filter(t => t.status === 'pending').length === 0}
            >
              开始处理
            </Button>
          )}

          <Button 
            icon={<SettingOutlined />} 
            onClick={() => setSettingsVisible(true)}
          >
            设置
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: 24, background: '#f0f2f5' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '300px 1fr', 
          gap: 24,
          height: 'calc(100vh - 120px)'
        }}>
          {/* 左侧面板 */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 16,
            height: '100%'
          }}>
            {/* 模板选择器 */}
            <TemplateSelector />

            {/* 文件上传 */}
            <FileUpload />

            {/* 快速操作 */}
            <div style={{ 
              background: '#fff', 
              borderRadius: 8, 
              padding: 16,
              flex: 1
            }}>
              <h3 style={{ marginBottom: 16 }}>快速操作</h3>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  icon={<FolderOutlined />}
                  style={{ width: '100%' }}
                  onClick={showStats}
                >
                  查看统计
                </Button>
                
                <Button 
                  icon={<DeleteOutlined />}
                  style={{ width: '100%' }}
                  onClick={handleClearCompleted}
                  disabled={stats.completedTasks === 0}
                >
                  清除已完成 ({stats.completedTasks})
                </Button>

                <Button 
                  style={{ width: '100%' }}
                  onClick={() => setSettingsVisible(true)}
                >
                  打开设置
                </Button>
              </Space>
            </div>
          </div>

          {/* 右侧主内容区 */}
          <div style={{ 
            background: '#fff', 
            borderRadius: 8, 
            padding: 16,
            height: '100%',
            overflow: 'hidden'
          }}>
            <TaskList />
          </div>
        </div>
      </Content>

      {/* 设置模态框 */}
      <SettingsModal 
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </Layout>
  );
};

export default App;