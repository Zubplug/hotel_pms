<Global.Microsoft.VisualBasic.CompilerServices.DesignerGenerated()> _
Partial Class IDD102
    Inherits System.Windows.Forms.Form

    'Form 重写 Dispose，以清理组件列表。
    <System.Diagnostics.DebuggerNonUserCode()> _
    Protected Overrides Sub Dispose(ByVal disposing As Boolean)
        If disposing AndAlso components IsNot Nothing Then
            components.Dispose()
        End If
        MyBase.Dispose(disposing)
    End Sub

    'Windows 窗体设计器所必需的
    Private components As System.ComponentModel.IContainer

    '注意: 以下过程是 Windows 窗体设计器所必需的
    '可以使用 Windows 窗体设计器修改它。
    '不要使用代码编辑器修改它。
    <System.Diagnostics.DebuggerStepThrough()> _
    Private Sub InitializeComponent()
        Dim resources As System.ComponentModel.ComponentResourceManager = New System.ComponentModel.ComponentResourceManager(GetType(IDD102))
        Me.IDD102_1000 = New System.Windows.Forms.RadioButton
        Me.IDD102_1001 = New System.Windows.Forms.RadioButton
        Me.IDD102_1002 = New System.Windows.Forms.Button
        Me.IDD102_1013 = New System.Windows.Forms.Label
        Me.txtRoomNo = New System.Windows.Forms.TextBox
        Me.txtInTime = New System.Windows.Forms.TextBox
        Me.txtOutTime = New System.Windows.Forms.TextBox
        Me.IDD102_1014 = New System.Windows.Forms.Label
        Me.IDD102_1011 = New System.Windows.Forms.Button
        Me.IDD102_1009 = New System.Windows.Forms.Button
        Me.IDD102_1005 = New System.Windows.Forms.Button
        Me.IDD102_1003 = New System.Windows.Forms.Button
        Me.IDD102_1012 = New System.Windows.Forms.Label
        Me.CheckBox1 = New System.Windows.Forms.CheckBox
        Me.IDD102_1016 = New System.Windows.Forms.CheckBox
        Me.IDD102_1018 = New System.Windows.Forms.CheckBox
        Me.IDD102_1017 = New System.Windows.Forms.CheckBox
        Me.SuspendLayout()
        '
        'IDD102_1000
        '
        Me.IDD102_1000.AutoSize = True
        Me.IDD102_1000.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1000.Location = New System.Drawing.Point(41, 25)
        Me.IDD102_1000.Name = "IDD102_1000"
        Me.IDD102_1000.Size = New System.Drawing.Size(66, 20)
        Me.IDD102_1000.TabIndex = 0
        Me.IDD102_1000.Text = "4-T57"
        Me.IDD102_1000.UseVisualStyleBackColor = True
        '
        'IDD102_1001
        '
        Me.IDD102_1001.AutoSize = True
        Me.IDD102_1001.Checked = True
        Me.IDD102_1001.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1001.Location = New System.Drawing.Point(219, 25)
        Me.IDD102_1001.Name = "IDD102_1001"
        Me.IDD102_1001.Size = New System.Drawing.Size(74, 20)
        Me.IDD102_1001.TabIndex = 1
        Me.IDD102_1001.TabStop = True
        Me.IDD102_1001.Text = "5-RF50"
        Me.IDD102_1001.UseVisualStyleBackColor = True
        '
        'IDD102_1002
        '
        Me.IDD102_1002.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1002.Location = New System.Drawing.Point(401, 12)
        Me.IDD102_1002.Name = "IDD102_1002"
        Me.IDD102_1002.Size = New System.Drawing.Size(118, 41)
        Me.IDD102_1002.TabIndex = 2
        Me.IDD102_1002.Text = "配置SDK"
        Me.IDD102_1002.UseVisualStyleBackColor = True
        '
        'IDD102_1013
        '
        Me.IDD102_1013.AutoSize = True
        Me.IDD102_1013.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1013.Location = New System.Drawing.Point(20, 201)
        Me.IDD102_1013.Name = "IDD102_1013"
        Me.IDD102_1013.Size = New System.Drawing.Size(56, 16)
        Me.IDD102_1013.TabIndex = 3
        Me.IDD102_1013.Text = "门锁号"
        '
        'txtRoomNo
        '
        Me.txtRoomNo.Location = New System.Drawing.Point(113, 201)
        Me.txtRoomNo.Name = "txtRoomNo"
        Me.txtRoomNo.Size = New System.Drawing.Size(406, 21)
        Me.txtRoomNo.TabIndex = 4
        '
        'txtInTime
        '
        Me.txtInTime.Location = New System.Drawing.Point(113, 264)
        Me.txtInTime.Name = "txtInTime"
        Me.txtInTime.Size = New System.Drawing.Size(406, 21)
        Me.txtInTime.TabIndex = 6
        '
        'txtOutTime
        '
        Me.txtOutTime.Location = New System.Drawing.Point(113, 335)
        Me.txtOutTime.Name = "txtOutTime"
        Me.txtOutTime.Size = New System.Drawing.Size(406, 21)
        Me.txtOutTime.TabIndex = 8
        '
        'IDD102_1014
        '
        Me.IDD102_1014.AutoSize = True
        Me.IDD102_1014.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1014.Location = New System.Drawing.Point(20, 335)
        Me.IDD102_1014.Name = "IDD102_1014"
        Me.IDD102_1014.Size = New System.Drawing.Size(72, 16)
        Me.IDD102_1014.TabIndex = 7
        Me.IDD102_1014.Text = "预离时间"
        '
        'IDD102_1011
        '
        Me.IDD102_1011.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1011.Location = New System.Drawing.Point(20, 262)
        Me.IDD102_1011.Name = "IDD102_1011"
        Me.IDD102_1011.Size = New System.Drawing.Size(81, 23)
        Me.IDD102_1011.TabIndex = 4
        Me.IDD102_1011.Text = "入住时间"
        Me.IDD102_1011.UseVisualStyleBackColor = True
        '
        'IDD102_1009
        '
        Me.IDD102_1009.Enabled = False
        Me.IDD102_1009.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1009.Location = New System.Drawing.Point(401, 396)
        Me.IDD102_1009.Name = "IDD102_1009"
        Me.IDD102_1009.Size = New System.Drawing.Size(118, 41)
        Me.IDD102_1009.TabIndex = 2
        Me.IDD102_1009.Text = "读  卡"
        Me.IDD102_1009.UseVisualStyleBackColor = True
        '
        'IDD102_1005
        '
        Me.IDD102_1005.Enabled = False
        Me.IDD102_1005.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1005.Location = New System.Drawing.Point(219, 396)
        Me.IDD102_1005.Name = "IDD102_1005"
        Me.IDD102_1005.Size = New System.Drawing.Size(118, 41)
        Me.IDD102_1005.TabIndex = 1
        Me.IDD102_1005.Text = "销  卡"
        Me.IDD102_1005.UseVisualStyleBackColor = True
        '
        'IDD102_1003
        '
        Me.IDD102_1003.Enabled = False
        Me.IDD102_1003.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1003.Location = New System.Drawing.Point(37, 396)
        Me.IDD102_1003.Name = "IDD102_1003"
        Me.IDD102_1003.Size = New System.Drawing.Size(118, 41)
        Me.IDD102_1003.TabIndex = 0
        Me.IDD102_1003.Text = "入  住"
        Me.IDD102_1003.UseVisualStyleBackColor = True
        '
        'IDD102_1012
        '
        Me.IDD102_1012.Font = New System.Drawing.Font("宋体", 12.0!)
        Me.IDD102_1012.Location = New System.Drawing.Point(20, 153)
        Me.IDD102_1012.Name = "IDD102_1012"
        Me.IDD102_1012.Size = New System.Drawing.Size(543, 37)
        Me.IDD102_1012.TabIndex = 13
        Me.IDD102_1012.Text = "Please enter the Lock Number here, not the Room Number! (Please refer to the help" & _
            " documents)"
        '
        'CheckBox1
        '
        Me.CheckBox1.AutoSize = True
        Me.CheckBox1.Location = New System.Drawing.Point(0, 0)
        Me.CheckBox1.Name = "CheckBox1"
        Me.CheckBox1.Size = New System.Drawing.Size(78, 16)
        Me.CheckBox1.TabIndex = 14
        Me.CheckBox1.Text = "CheckBox1"
        Me.CheckBox1.UseVisualStyleBackColor = True
        '
        'IDD102_1016
        '
        Me.IDD102_1016.AutoSize = True
        Me.IDD102_1016.Location = New System.Drawing.Point(41, 81)
        Me.IDD102_1016.Name = "IDD102_1016"
        Me.IDD102_1016.Size = New System.Drawing.Size(96, 16)
        Me.IDD102_1016.TabIndex = 15
        Me.IDD102_1016.Text = "新卡顶替旧卡"
        Me.IDD102_1016.UseVisualStyleBackColor = True
        '
        'IDD102_1018
        '
        Me.IDD102_1018.AutoSize = True
        Me.IDD102_1018.Checked = True
        Me.IDD102_1018.CheckState = System.Windows.Forms.CheckState.Checked
        Me.IDD102_1018.Location = New System.Drawing.Point(178, 81)
        Me.IDD102_1018.Name = "IDD102_1018"
        Me.IDD102_1018.Size = New System.Drawing.Size(84, 16)
        Me.IDD102_1018.TabIndex = 16
        Me.IDD102_1018.Text = "允许开反锁"
        Me.IDD102_1018.UseVisualStyleBackColor = True
        '
        'IDD102_1017
        '
        Me.IDD102_1017.AutoSize = True
        Me.IDD102_1017.Location = New System.Drawing.Point(306, 81)
        Me.IDD102_1017.Name = "IDD102_1017"
        Me.IDD102_1017.Size = New System.Drawing.Size(156, 16)
        Me.IDD102_1017.TabIndex = 17
        Me.IDD102_1017.Text = "检查入住时间(用于预订)"
        Me.IDD102_1017.UseVisualStyleBackColor = True
        '
        'IDD102
        '
        Me.AutoScaleDimensions = New System.Drawing.SizeF(6.0!, 12.0!)
        Me.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font
        Me.ClientSize = New System.Drawing.Size(571, 498)
        Me.Controls.Add(Me.IDD102_1017)
        Me.Controls.Add(Me.IDD102_1018)
        Me.Controls.Add(Me.IDD102_1016)
        Me.Controls.Add(Me.CheckBox1)
        Me.Controls.Add(Me.IDD102_1002)
        Me.Controls.Add(Me.IDD102_1011)
        Me.Controls.Add(Me.IDD102_1009)
        Me.Controls.Add(Me.IDD102_1012)
        Me.Controls.Add(Me.IDD102_1005)
        Me.Controls.Add(Me.IDD102_1003)
        Me.Controls.Add(Me.txtOutTime)
        Me.Controls.Add(Me.IDD102_1014)
        Me.Controls.Add(Me.txtInTime)
        Me.Controls.Add(Me.txtRoomNo)
        Me.Controls.Add(Me.IDD102_1013)
        Me.Controls.Add(Me.IDD102_1001)
        Me.Controls.Add(Me.IDD102_1000)
        Me.Icon = CType(resources.GetObject("$this.Icon"), System.Drawing.Icon)
        Me.MaximizeBox = False
        Me.MinimizeBox = False
        Me.Name = "IDD102"
        Me.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen
        Me.Text = "LockSDKDemo"
        Me.ResumeLayout(False)
        Me.PerformLayout()

    End Sub
    Friend WithEvents IDD102_1000 As System.Windows.Forms.RadioButton
    Friend WithEvents IDD102_1001 As System.Windows.Forms.RadioButton
    Friend WithEvents IDD102_1002 As System.Windows.Forms.Button
    Friend WithEvents IDD102_1013 As System.Windows.Forms.Label
    Friend WithEvents txtRoomNo As System.Windows.Forms.TextBox
    Friend WithEvents txtInTime As System.Windows.Forms.TextBox
    Friend WithEvents txtOutTime As System.Windows.Forms.TextBox
    Friend WithEvents IDD102_1014 As System.Windows.Forms.Label
    Friend WithEvents IDD102_1009 As System.Windows.Forms.Button
    Friend WithEvents IDD102_1005 As System.Windows.Forms.Button
    Friend WithEvents IDD102_1003 As System.Windows.Forms.Button
    'Friend WithEvents lblMsg As System.Windows.Forms.Label
    Friend WithEvents IDD102_1012 As System.Windows.Forms.Label
    Friend WithEvents IDD102_1011 As System.Windows.Forms.Button
    Friend WithEvents CheckBox1 As System.Windows.Forms.CheckBox
    Friend WithEvents IDD102_1016 As System.Windows.Forms.CheckBox
    Friend WithEvents IDD102_1018 As System.Windows.Forms.CheckBox
    Friend WithEvents IDD102_1017 As System.Windows.Forms.CheckBox

End Class
