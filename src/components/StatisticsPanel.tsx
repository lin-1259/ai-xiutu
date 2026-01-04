import React from 'react';
import { Row, Col, Card, Statistic, Progress, Table, Tag } from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { Task } from '../types';

interface StatisticsPanelProps {
  stats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    processingTasks: number;
    totalCost: number;
  };
  tasks: Task[];
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ stats, tasks }) => {
  const completionRate = stats.totalTasks > 0 ? 
    (stats.completedTasks / stats.totalTasks * 100).toFixed(1) : '0';

  const failureRate = stats.totalTasks > 0 ? 
    (stats.failedTasks / stats.totalTasks * 100).toFixed(1) : '0';

  // 按模板分组统计
  const templateStats = tasks.reduce((acc, task) => {
    if (!acc[task.templateId]) {
      acc[task.templateId] = {
        total: 0,
        completed: 0,
        failed: 0,
        processing: 0,
        pending: 0
      };
    }
    
    acc[task.templateId].total++;
    acc[task.templateId][task.status]++;
    
    return acc;
  }, {} as Record<string, any>);

  const templateColumns = [
    {
      title: '模板ID',
      dataIndex: 'templateId',
      key: 'templateId',
    },
    {
      title: '总数',
      dataIndex: 'total',
      key: 'total',
    },
    {
      title: '已完成',
      dataIndex: 'completed',
      key: 'completed',
      render: (value: number) => (
        <Tag color="green">{value}</Tag>
      )
    },
    {
      title: '处理中',
      dataIndex: 'processing',
      key: 'processing',
      render: (value: number) => (
        <Tag color="blue">{value}</Tag>
      )
    },
    {
      title: '等待中',
      dataIndex: 'pending',
      key: 'pending',
      render: (value: number) => (
        <Tag color="orange">{value}</Tag>
      )
    },
    {
      title: '失败',
      dataIndex: 'failed',
      key: 'failed',
      render: (value: number) => (
        <Tag color="red">{value}</Tag>
      )
    },
    {
      title: '完成率',
      key: 'completionRate',
      render: (_: any, record: any) => {
        const rate = record.total > 0 ? (record.completed / record.total * 100).toFixed(1) : '0';
        return (
          <Progress 
            percent={parseFloat(rate)} 
            size="small" 
            format={() => `${rate}%`}
            strokeColor={parseFloat(rate) >= 80 ? '#52c41a' : parseFloat(rate) >= 50 ? '#faad14' : '#ff4d4f'}
          />
        );
      }
    }
  ];

  const templateData = Object.entries(templateStats).map(([templateId, stat]) => ({
    templateId,
    ...stat
  }));

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={stats.totalTasks}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completedTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="处理中"
              value={stats.processingTasks}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failedTasks}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="完成率统计">
            <Progress
              type="circle"
              percent={parseFloat(completionRate)}
              format={(percent) => `${percent}%`}
              strokeColor={parseFloat(completionRate) >= 80 ? '#52c41a' : parseFloat(completionRate) >= 50 ? '#faad14' : '#ff4d4f'}
            />
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#52c41a' }}>
                完成率: {completionRate}%
              </div>
              <div style={{ color: '#999', marginTop: 4 }}>
                {stats.completedTasks}/{stats.totalTasks} 个任务
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="费用统计">
            <Statistic
              title="总费用"
              value={stats.totalCost}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={stats.totalCost > 0 ? Math.min(stats.totalCost / 10, 100) : 0}
                strokeColor="#722ed1"
                showInfo={false}
              />
              <div style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
                预算使用情况
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="模板使用统计" style={{ marginBottom: 24 }}>
        <Table
          dataSource={templateData}
          columns={templateColumns}
          pagination={false}
          size="small"
          rowKey="templateId"
        />
      </Card>

      {stats.failedTasks > 0 && (
        <Card title="错误分析" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={parseFloat(failureRate)}
              strokeColor="#ff4d4f"
              format={(percent) => `失败率: ${percent}%`}
            />
          </div>
          
          <div style={{ color: '#666', fontSize: 12 }}>
            失败原因分析：
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>网络连接问题</li>
              <li>API配额超限</li>
              <li>图片格式不支持</li>
              <li>服务器错误</li>
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
};

export default StatisticsPanel;