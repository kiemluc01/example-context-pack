import { useState } from 'react';

export function TempPasswordNotice({ password, onClose }: { password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="alert alert-success" role="status">
      <div>
        <strong>Mật khẩu tạm thời:</strong> <code className="temp-password">{password}</code>
        <p className="muted small">
          Mật khẩu chỉ hiển thị một lần. Hãy gửi cho nhân viên qua kênh an toàn. Nhân viên phải đổi mật khẩu khi đăng nhập lần đầu.
        </p>
      </div>
      <div className="row gap-sm">
        <button type="button" className="btn btn-secondary" onClick={copy}>
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
