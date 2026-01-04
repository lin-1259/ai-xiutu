import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Logger } from './Logger.js';

const execAsync = promisify(exec);

export class SystemIntegration {
  private logger: Logger;
  private platform: string;

  constructor(logger: Logger) {
    this.logger = logger;
    this.platform = platform();
  }

  async installContextMenu(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.installWindowsContextMenu();
        case 'darwin':
          return await this.installMacContextMenu();
        case 'linux':
          return await this.installLinuxContextMenu();
        default:
          this.logger.warn(`不支持的操作系统: ${this.platform}`);
          return false;
      }
    } catch (error) {
      this.logger.error('安装右键菜单失败', error);
      return false;
    }
  }

  async uninstallContextMenu(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.uninstallWindowsContextMenu();
        case 'darwin':
          return await this.uninstallMacContextMenu();
        case 'linux':
          return await this.uninstallLinuxContextMenu();
        default:
          this.logger.warn(`不支持的操作系统: ${this.platform}`);
          return false;
      }
    } catch (error) {
      this.logger.error('卸载右键菜单失败', error);
      return false;
    }
  }

  private async installWindowsContextMenu(): Promise<boolean> {
    try {
      const appPath = process.execPath;
      const appName = 'AI批量修图助手';
      
      // 注册表脚本
      const registryScript = `
Windows Registry Editor Version 5.00

; 为所有图片类型添加右键菜单
[HKEY_CLASSES_ROOT\\*\\shell\\AiPhotoEditor]
@="AI批量修图(&A)"

[HKEY_CLASSES_ROOT\\*\\shell\\AiPhotoEditor\\command]
@="\\"${appPath}\\" \\"--process-files\\" \\"%1\\""

; 为文件夹添加右键菜单
[HKEY_CLASSES_ROOT\\Directory\\shell\\AiPhotoEditorFolder]
@="使用AI批量修图(&A)"

[HKEY_CLASSES_ROOT\\Directory\\shell\\AiPhotoEditorFolder\\command]
@="\\"${appPath}\\" \\"--process-directory\\" \\"%1\\""
      `.trim();

      const tempScriptPath = join(process.env.TEMP || 'C:\\temp', 'install_context_menu.reg');
      
      // 写入临时注册表文件
      writeFileSync(tempScriptPath, registryScript, 'utf8');
      
      // 执行注册表导入
      await execAsync(`regedit /s "${tempScriptPath}"`);
      
      // 删除临时文件
      const fs = await import('fs');
      fs.unlinkSync(tempScriptPath);
      
      this.logger.info('Windows右键菜单安装成功');
      return true;
      
    } catch (error) {
      this.logger.error('Windows右键菜单安装失败', error);
      return false;
    }
  }

  private async uninstallWindowsContextMenu(): Promise<boolean> {
    try {
      // 注册表删除脚本
      const unregistryScript = `
Windows Registry Editor Version 5.00

; 删除右键菜单
[-HKEY_CLASSES_ROOT\\*\\shell\\AiPhotoEditor]
[-HKEY_CLASSES_ROOT\\Directory\\shell\\AiPhotoEditorFolder]
      `.trim();

      const tempScriptPath = join(process.env.TEMP || 'C:\\temp', 'uninstall_context_menu.reg');
      
      writeFileSync(tempScriptPath, unregistryScript, 'utf8');
      await execAsync(`regedit /s "${tempScriptPath}"`);
      
      const fs = await import('fs');
      fs.unlinkSync(tempScriptPath);
      
      this.logger.info('Windows右键菜单卸载成功');
      return true;
      
    } catch (error) {
      this.logger.error('Windows右键菜单卸载失败', error);
      return false;
    }
  }

  private async installMacContextMenu(): Promise<boolean> {
    try {
      // macOS使用AppleScript创建服务
      const appleScript = `
tell application "System Events"
  -- 检查是否已存在服务
  if exists workflow "AI批量修图" then
    delete workflow "AI批量修图"
  end if
  
  -- 创建新服务
  make new workflow with properties {name:"AI批量修图"}
  
  tell workflow "AI批量修图"
    -- 设置输入类型为图片文件
    set accepts input to {folder, file}
    
    -- 添加运行应用程序动作
    make new workflow step with properties {kind:application step, action:"/Applications/AI批量修图助手.app", comment:"使用AI批量修图处理选中的文件"}
  end tell
end tell
      `.trim();

      const tempScriptPath = join(process.env.HOME || '/tmp', 'install_context_menu.applescript');
      
      writeFileSync(tempScriptPath, appleScript, 'utf8');
      
      // 执行AppleScript
      await execAsync(`osascript "${tempScriptPath}"`);
      
      const fs = await import('fs');
      fs.unlinkSync(tempScriptPath);
      
      this.logger.info('macOS右键菜单安装成功');
      return true;
      
    } catch (error) {
      this.logger.error('macOS右键菜单安装失败', error);
      return false;
    }
  }

  private async uninstallMacContextMenu(): Promise<boolean> {
    try {
      const appleScript = `
tell application "System Events"
  if exists workflow "AI批量修图" then
    delete workflow "AI批量修图"
  end if
end tell
      `.trim();

      const tempScriptPath = join(process.env.HOME || '/tmp', 'uninstall_context_menu.applescript');
      
      writeFileSync(tempScriptPath, appleScript, 'utf8');
      await execAsync(`osascript "${tempScriptPath}"`);
      
      const fs = await import('fs');
      fs.unlinkSync(tempScriptPath);
      
      this.logger.info('macOS右键菜单卸载成功');
      return true;
      
    } catch (error) {
      this.logger.error('macOS右键菜单卸载失败', error);
      return false;
    }
  }

  private async installLinuxContextMenu(): Promise<boolean> {
    try {
      // Linux使用.desktop文件和MimeInfo
      const desktopFile = `
[Desktop Entry]
Type=Application
Name=AI批量修图助手
Comment=AI驱动的批量图片处理工具
Exec=${process.execPath} --process-files %F
Icon=ai-photo-editor
Terminal=false
Categories=Graphics;Photography;
MimeType=image/jpeg;image/png;image/bmp;image/tiff;inode/directory;
      `.trim();

      const userDesktopDir = join(process.env.HOME || '/tmp', '.local/share/applications');
      const desktopFilePath = join(userDesktopDir, 'ai-photo-editor.desktop');
      
      // 创建目录
      const fs = await import('fs');
      if (!existsSync(userDesktopDir)) {
        fs.mkdirSync(userDesktopDir, { recursive: true });
      }
      
      // 写入desktop文件
      writeFileSync(desktopFilePath, desktopFile, 'utf8');
      
      // 使文件可执行
      await execAsync(`chmod +x "${desktopFilePath}"`);
      
      // 更新桌面数据库
      await execAsync('update-desktop-database ~/.local/share/applications');
      
      this.logger.info('Linux右键菜单安装成功');
      return true;
      
    } catch (error) {
      this.logger.error('Linux右键菜单安装失败', error);
      return false;
    }
  }

  private async uninstallLinuxContextMenu(): Promise<boolean> {
    try {
      const desktopFilePath = join(process.env.HOME || '/tmp', '.local/share/applications/ai-photo-editor.desktop');
      
      const fs = await import('fs');
      if (existsSync(desktopFilePath)) {
        fs.unlinkSync(desktopFilePath);
        await execAsync('update-desktop-database ~/.local/share/applications');
      }
      
      this.logger.info('Linux右键菜单卸载成功');
      return true;
      
    } catch (error) {
      this.logger.error('Linux右键菜单卸载失败', error);
      return false;
    }
  }

  async installAutoStart(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.installWindowsAutoStart();
        case 'darwin':
          return await this.installMacAutoStart();
        case 'linux':
          return await this.installLinuxAutoStart();
        default:
          return false;
      }
    } catch (error) {
      this.logger.error('安装开机自启失败', error);
      return false;
    }
  }

  private async installWindowsAutoStart(): Promise<boolean> {
    try {
      const appName = 'AI批量修图助手';
      const appPath = process.execPath;
      
      const vbsScript = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "%USERPROFILE%\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\AI批量修图助手.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "${appPath}"
oLink.WorkingDirectory = "%USERPROFILE%"
oLink.Description = "AI批量修图助手"
oLink.Save
      `.trim();

      const tempScriptPath = join(process.env.TEMP || 'C:\\temp', 'install_autostart.vbs');
      
      writeFileSync(tempScriptPath, vbsScript, 'utf8');
      await execAsync(`cscript "${tempScriptPath}"`);
      
      const fs = await import('fs');
      fs.unlinkSync(tempScriptPath);
      
      return true;
      
    } catch (error) {
      this.logger.error('Windows开机自启安装失败', error);
      return false;
    }
  }

  private async installMacAutoStart(): Promise<boolean> {
    try {
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.aiphotoeditor.desktop</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>`;

      const plistPath = join(process.env.HOME || '/tmp', 'Library/LaunchAgents/com.aiphotoeditor.desktop.plist');
      
      const fs = await import('fs');
      const plistDir = join(process.env.HOME || '/tmp', 'Library/LaunchAgents');
      
      if (!existsSync(plistDir)) {
        fs.mkdirSync(plistDir, { recursive: true });
      }
      
      writeFileSync(plistPath, plistContent, 'utf8');
      
      return true;
      
    } catch (error) {
      this.logger.error('macOS开机自启安装失败', error);
      return false;
    }
  }

  private async installLinuxAutoStart(): Promise<boolean> {
    try {
      const desktopFile = `
[Desktop Entry]
Type=Application
Name=AI批量修图助手
Exec=${process.execPath}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
      `.trim();

      const autostartDir = join(process.env.HOME || '/tmp', '.config/autostart');
      const desktopFilePath = join(autostartDir, 'ai-photo-editor.desktop');
      
      const fs = await import('fs');
      if (!existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true });
      }
      
      writeFileSync(desktopFilePath, desktopFile, 'utf8');
      
      return true;
      
    } catch (error) {
      this.logger.error('Linux开机自启安装失败', error);
      return false;
    }
  }

  // 检查是否安装了右键菜单
  async isContextMenuInstalled(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          return await this.checkWindowsContextMenu();
        case 'darwin':
          return await this.checkMacContextMenu();
        case 'linux':
          return await this.checkLinuxContextMenu();
        default:
          return false;
      }
    } catch (error) {
      this.logger.error('检查右键菜单状态失败', error);
      return false;
    }
  }

  private async checkWindowsContextMenu(): Promise<boolean> {
    try {
      const result = await execAsync('reg query "HKEY_CLASSES_ROOT\\*\\shell\\AiPhotoEditor"');
      return result.stdout.includes('AiPhotoEditor');
    } catch (error) {
      return false;
    }
  }

  private async checkMacContextMenu(): Promise<boolean> {
    try {
      const result = await execAsync('automator -L | grep "AI批量修图"');
      return result.stdout.includes('AI批量修图');
    } catch (error) {
      return false;
    }
  }

  private async checkLinuxContextMenu(): Promise<boolean> {
    try {
      const desktopFilePath = join(process.env.HOME || '/tmp', '.local/share/applications/ai-photo-editor.desktop');
      return existsSync(desktopFilePath);
    } catch (error) {
      return false;
    }
  }

  // 获取系统信息
  getSystemInfo(): any {
    return {
      platform: this.platform,
      arch: process.arch,
      version: process.version,
      execPath: process.execPath,
      userData: process.env.APPDATA || process.env.HOME
    };
  }

  destroy(): void {
    this.logger.info('系统集成管理器已关闭');
  }
}