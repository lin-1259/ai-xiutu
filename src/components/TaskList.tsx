import React, { useEffect, useState } from 'react';
import { List, Card, Badge, Button, Space, Progress, Image, Typography, Empty } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  DeleteOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useAppStore } from '../stores/appStore';
import { Task } from '../types';

const { Text } = Typography;

const TaskList: React.FC = () => {
  const { tasks, updateTask, removeTask, selectedTemplateId } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>('all');

  // 监听任务更新
  useEffect(() => {
    const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
      updateTask(taskId, updates);
    };

    if (window.electronAPI) {
      window.electronAPI.onTaskProgress((taskId: string, progress: any) => {
        handleTaskUpdate(taskId, { 
          progress: progress.progress,
          status: progress.status || 'processing'
        });
      });

      window.electronAPI.onTaskCompleted((taskId: string, result: any) => {
        handleTaskUpdate(taskId, {
          status: 'completed',
          progress: 100,
          result: result
        });
      });

      window.electronAPI.onTaskFailed((taskId: string, error: string) => {
        handleTaskUpdate(taskId, {
          status: 'failed',
          error: error
        });
      });
    }
  }, [updateTask]);

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#999' }} />;
      case 'processing':
        return <PlayCircleOutlined style={{ color: '#1890ff' }} />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#999' }} />;
    }
  };

  const getStatusText = (status: Task['status']) => {
    switch (status) {
      case 'pending': return '等待处理';
      case 'processing': return '处理中';
      case 'completed': return '已完成';
      case 'failed': return '处理失败';
      default: return '未知状态';
    }
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.pauseTask(taskId);
        updateTask(taskId, { status: 'pending' });
      }
    } catch (error) {
      console.error('暂停任务失败:', error);
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.resumeTask(taskId);
        updateTask(taskId, { status: 'pending' });
      }
    } catch (error) {
      console.error('恢复任务失败:', error);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    removeTask(taskId);
  };

  const handleRetryTask = async (task: Task) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.addTask({
          id: `retry_${Date.now()}`,
          imageId: task.imageId,
          templateId: task.templateId,
          priority: task.priority
        });
      }
    } catch (error) {
      console.error('重试任务失败:', error);
    }
  };

  if (tasks.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty 
          description="暂无任务" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 筛选器 */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 16, 
        flexWrap: 'wrap' 
      }}>
        {[
          { key: 'all', label: '全部', count: tasks.length },
          { key: 'pending', label: '等待', count: tasks.filter(t => t.status === 'pending').length },
          { key: 'processing', label: '处理中', count: tasks.filter(t => t.status === 'processing').length },
          { key: 'completed', label: '已完成', count: tasks.filter(t => t.status === 'completed').length },
          { key: 'failed', label: '失败', count: tasks.filter(t => t.status === 'failed').length }
        ].map(item => (
          <Button
            key={item.key}
            size="small"
            type={filter === item.key ? 'primary' : 'default'}
            onClick={() => setFilter(item.key as any)}
          >
            {item.label} ({item.count})
          </Button>
        ))}
      </div>

      {/* 任务列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <List
          dataSource={filteredTasks}
          renderItem={(task) => (
            <List.Item
              style={{ 
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0'
              }}
              actions={[
                task.status === 'processing' ? (
                  <Button
                    size="small"
                    icon={<PauseCircleOutlined />}
                    onClick={() => handlePauseTask(task.id)}
                  >
                    暂停
                  </Button>
                ) : task.status === 'failed' ? (
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => handleRetryTask(task)}
                  >
                    重试
                  </Button>
                ) : null,
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteTask(task.id)}
                >
                  删除
                </Button>
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={
                  <Badge 
                    count={getStatusIcon(task.status)} 
                    offset={[-5, 5]}
                  />
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>{task.id}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {getStatusText(task.status)}
                    </Text>
                  </div>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <Text type="secondary">模板: {task.templateId}</Text>
                        <Text type="secondary">优先级: {task.priority}</Text>
                        <Text type="secondary">重试: {task.retryCount}/{task.maxRetries}</Text>
                      </Space>
                    </div>
                    
                    {/* 进度条 */}
                    {task.status === 'processing' && (
                      <Progress 
                        percent={task.progress} 
                        size="small" 
                        showInfo={false}
                        strokeColor="#1890ff"
                      />
                    )}

                    {/* 错误信息 */}
                    {task.status === 'failed' && task.error && (
                      <Text type="danger" style={{ fontSize: 12 }}>
                        错误: {task.error}
                      </Text>
                    )}

                    {/* 完成时间 */}
                    {task.status === 'completed' && task.completedAt && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        完成时间: {new Date(task.completedAt).toLocaleString()}
                      </Text>
                    )}

                    {/* 费用 */}
                    {task.cost > 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        费用: ¥{task.cost.toFixed(2)}
                      </Text>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
};

export default TaskList;