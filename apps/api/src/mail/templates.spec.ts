import { copyAlertEmail, inviteEmail, resetEmail } from './templates';

describe('email templates', () => {
  const url = 'https://app.example.com';

  it('renders the invite email with credentials and no template leaks', () => {
    const r = inviteEmail({ email: 'new@admin.com', password: 'Temp#1234', url });
    expect(r.subject).toMatch(/admin account/i);
    expect(r.html).toContain('new@admin.com');
    expect(r.html).toContain('Temp#1234');
    expect(r.html).toContain('https://app.example.com/login');
    expect(r.html).not.toContain('${');
    expect(r.html).not.toContain('undefined');
    expect(r.text).toContain('Temp#1234');
  });

  it('renders the reset email', () => {
    const r = resetEmail({ email: 'a@b.com', password: 'New#5678', url });
    expect(r.subject).toMatch(/password/i);
    expect(r.html).toContain('New#5678');
    expect(r.html).not.toContain('${');
  });

  it('renders the copy-alert email', () => {
    const r = copyAlertEmail({
      order: 'BUY 1.00 EURUSD (OPEN)',
      master: 'Master (#123)',
      slave: 'Slave (#456)',
      url,
    });
    expect(r.subject).toMatch(/EURUSD/);
    expect(r.html).toContain('EURUSD');
    expect(r.html).toContain('Master (#123)');
    expect(r.html).not.toContain('${');
  });

  it('escapes HTML in interpolated values', () => {
    const r = inviteEmail({ email: 'x@y.com', password: '<script>alert(1)</script>', url });
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('omits the sign-in link when no url is provided', () => {
    const r = inviteEmail({ email: 'x@y.com', password: 'p', url: null });
    expect(r.text).not.toContain('/login');
  });
});
