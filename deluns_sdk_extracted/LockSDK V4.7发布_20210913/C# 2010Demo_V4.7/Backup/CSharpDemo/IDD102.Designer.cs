namespace CSharpDemo
{
    partial class IDD102
    {
        /// <summary>
        /// 必需的设计器变量。
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// 清理所有正在使用的资源。
        /// </summary>
        /// <param name="disposing">如果应释放托管资源，为 true；否则为 false。</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows 窗体设计器生成的代码

        /// <summary>
        /// 设计器支持所需的方法 - 不要
        /// 使用代码编辑器修改此方法的内容。
        /// </summary>
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(IDD102));
            this.IDD102_1000 = new System.Windows.Forms.RadioButton();
            this.IDD102_1001 = new System.Windows.Forms.RadioButton();
            this.IDD102_1002 = new System.Windows.Forms.Button();
            this.IDD102_1012 = new System.Windows.Forms.Label();
            this.IDD102_1013 = new System.Windows.Forms.Label();
            this.txtRoomNo = new System.Windows.Forms.TextBox();
            this.IDD102_1011 = new System.Windows.Forms.Button();
            this.txtOutTime = new System.Windows.Forms.TextBox();
            this.IDD102_1014 = new System.Windows.Forms.Label();
            this.txtInTime = new System.Windows.Forms.TextBox();
            this.IDD102_1003 = new System.Windows.Forms.Button();
            this.IDD102_1005 = new System.Windows.Forms.Button();
            this.IDD102_1009 = new System.Windows.Forms.Button();
            this.SuspendLayout();
            // 
            // IDD102_1000
            // 
            this.IDD102_1000.AutoSize = true;
            this.IDD102_1000.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1000.Location = new System.Drawing.Point(48, 38);
            this.IDD102_1000.Name = "IDD102_1000";
            this.IDD102_1000.Size = new System.Drawing.Size(90, 20);
            this.IDD102_1000.TabIndex = 0;
            this.IDD102_1000.Text = "4-RF57卡";
            this.IDD102_1000.UseVisualStyleBackColor = true;
            // 
            // IDD102_1001
            // 
            this.IDD102_1001.AutoSize = true;
            this.IDD102_1001.Checked = true;
            this.IDD102_1001.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1001.Location = new System.Drawing.Point(231, 38);
            this.IDD102_1001.Name = "IDD102_1001";
            this.IDD102_1001.Size = new System.Drawing.Size(90, 20);
            this.IDD102_1001.TabIndex = 1;
            this.IDD102_1001.TabStop = true;
            this.IDD102_1001.Text = "5-RF50卡";
            this.IDD102_1001.UseVisualStyleBackColor = true;
            // 
            // IDD102_1002
            // 
            this.IDD102_1002.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1002.Location = new System.Drawing.Point(421, 27);
            this.IDD102_1002.Name = "IDD102_1002";
            this.IDD102_1002.Size = new System.Drawing.Size(112, 39);
            this.IDD102_1002.TabIndex = 2;
            this.IDD102_1002.Text = "配置SDK";
            this.IDD102_1002.UseVisualStyleBackColor = true;
            this.IDD102_1002.Click += new System.EventHandler(this.IDD102_1002_Click);
            // 
            // IDD102_1012
            // 
            this.IDD102_1012.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1012.Location = new System.Drawing.Point(24, 83);
            this.IDD102_1012.Name = "IDD102_1012";
            this.IDD102_1012.Size = new System.Drawing.Size(532, 46);
            this.IDD102_1012.TabIndex = 3;
            this.IDD102_1012.Text = "Please enter the Lock Number here, not the Room Number! (Please refer to the help" +
                " documents)";
            // 
            // IDD102_1013
            // 
            this.IDD102_1013.AutoSize = true;
            this.IDD102_1013.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1013.Location = new System.Drawing.Point(24, 132);
            this.IDD102_1013.Name = "IDD102_1013";
            this.IDD102_1013.Size = new System.Drawing.Size(72, 16);
            this.IDD102_1013.TabIndex = 4;
            this.IDD102_1013.Text = "门锁号：";
            // 
            // txtRoomNo
            // 
            this.txtRoomNo.Location = new System.Drawing.Point(124, 132);
            this.txtRoomNo.Name = "txtRoomNo";
            this.txtRoomNo.Size = new System.Drawing.Size(409, 21);
            this.txtRoomNo.TabIndex = 5;
            // 
            // IDD102_1011
            // 
            this.IDD102_1011.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1011.Location = new System.Drawing.Point(27, 179);
            this.IDD102_1011.Name = "IDD102_1011";
            this.IDD102_1011.Size = new System.Drawing.Size(90, 31);
            this.IDD102_1011.TabIndex = 6;
            this.IDD102_1011.Text = "入住时间";
            this.IDD102_1011.UseVisualStyleBackColor = true;
            this.IDD102_1011.Click += new System.EventHandler(this.IDD102_1011_Click);
            // 
            // txtOutTime
            // 
            this.txtOutTime.Location = new System.Drawing.Point(124, 238);
            this.txtOutTime.Name = "txtOutTime";
            this.txtOutTime.Size = new System.Drawing.Size(409, 21);
            this.txtOutTime.TabIndex = 8;
            // 
            // IDD102_1014
            // 
            this.IDD102_1014.AutoSize = true;
            this.IDD102_1014.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1014.Location = new System.Drawing.Point(24, 238);
            this.IDD102_1014.Name = "IDD102_1014";
            this.IDD102_1014.Size = new System.Drawing.Size(88, 16);
            this.IDD102_1014.TabIndex = 7;
            this.IDD102_1014.Text = "预离时间：";
            // 
            // txtInTime
            // 
            this.txtInTime.Location = new System.Drawing.Point(124, 187);
            this.txtInTime.Name = "txtInTime";
            this.txtInTime.Size = new System.Drawing.Size(409, 21);
            this.txtInTime.TabIndex = 9;
            // 
            // IDD102_1003
            // 
            this.IDD102_1003.Enabled = false;
            this.IDD102_1003.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1003.Location = new System.Drawing.Point(70, 301);
            this.IDD102_1003.Name = "IDD102_1003";
            this.IDD102_1003.Size = new System.Drawing.Size(112, 39);
            this.IDD102_1003.TabIndex = 10;
            this.IDD102_1003.Text = "入  住";
            this.IDD102_1003.UseVisualStyleBackColor = true;
            this.IDD102_1003.Click += new System.EventHandler(this.IDD102_1003_Click);
            // 
            // IDD102_1005
            // 
            this.IDD102_1005.Enabled = false;
            this.IDD102_1005.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1005.Location = new System.Drawing.Point(247, 301);
            this.IDD102_1005.Name = "IDD102_1005";
            this.IDD102_1005.Size = new System.Drawing.Size(112, 39);
            this.IDD102_1005.TabIndex = 11;
            this.IDD102_1005.Text = "销  卡";
            this.IDD102_1005.UseVisualStyleBackColor = true;
            this.IDD102_1005.Click += new System.EventHandler(this.IDD102_1005_Click);
            // 
            // IDD102_1009
            // 
            this.IDD102_1009.Enabled = false;
            this.IDD102_1009.Font = new System.Drawing.Font("宋体", 12F);
            this.IDD102_1009.Location = new System.Drawing.Point(421, 301);
            this.IDD102_1009.Name = "IDD102_1009";
            this.IDD102_1009.Size = new System.Drawing.Size(112, 39);
            this.IDD102_1009.TabIndex = 12;
            this.IDD102_1009.Text = "读  卡";
            this.IDD102_1009.UseVisualStyleBackColor = true;
            this.IDD102_1009.Click += new System.EventHandler(this.IDD102_1009_Click);
            // 
            // IDD102
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 12F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(572, 361);
            this.Controls.Add(this.IDD102_1009);
            this.Controls.Add(this.IDD102_1005);
            this.Controls.Add(this.IDD102_1003);
            this.Controls.Add(this.txtInTime);
            this.Controls.Add(this.txtOutTime);
            this.Controls.Add(this.IDD102_1014);
            this.Controls.Add(this.IDD102_1011);
            this.Controls.Add(this.txtRoomNo);
            this.Controls.Add(this.IDD102_1013);
            this.Controls.Add(this.IDD102_1012);
            this.Controls.Add(this.IDD102_1002);
            this.Controls.Add(this.IDD102_1001);
            this.Controls.Add(this.IDD102_1000);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.Name = "IDD102";
            this.Text = "LockSDK_Demo";
            this.Load += new System.EventHandler(this.LockSDK_Demo_Load);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.RadioButton IDD102_1000;
        private System.Windows.Forms.RadioButton IDD102_1001;
        private System.Windows.Forms.Button IDD102_1002;
        private System.Windows.Forms.Label IDD102_1012;
        private System.Windows.Forms.Label IDD102_1013;
        private System.Windows.Forms.TextBox txtRoomNo;
        private System.Windows.Forms.Button IDD102_1011;
        private System.Windows.Forms.TextBox txtOutTime;
        private System.Windows.Forms.Label IDD102_1014;
        private System.Windows.Forms.TextBox txtInTime;
        private System.Windows.Forms.Button IDD102_1003;
        private System.Windows.Forms.Button IDD102_1005;
        private System.Windows.Forms.Button IDD102_1009;
    }
}

