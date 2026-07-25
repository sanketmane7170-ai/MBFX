/**
 * Production email templates — table-based, inline-CSS, email-client safe
 * (Gmail, Apple Mail, Outlook, Yahoo, mobile). Shared premium design system:
 * #F8FAFC canvas, centered 620px white card, Inter/system fonts, green accent.
 *
 * Icons use email-safe glyphs/emoji inside CSS badges so they render without
 * external image hosting. Swap for hosted <img> icons for exact-artwork fidelity.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const C = {
  text: '#111827',
  sub: '#4B5563',
  body: '#374151',
  small: '#6B7280',
  footer: '#9CA3AF',
  border: '#E5E7EB',
  cardBorder: '#EAECEF',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  green: '#16A34A',
  greenText: '#15803D',
  greenBg: '#ECFDF5',
  greenBorder: '#BBF7D0',
  btn: '#111827',
  btnText: '#FFFFFF',
  amber: '#B45309',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  grey: '#6B7280',
  greyBg: '#F3F4F6',
};

const FONT =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

/** Circular icon badge (a cell with a glyph). Degrades to a square in Outlook. */
function badge(glyph: string, opts: { size: number; bg: string; color: string; fs: number; border?: string }): string {
  const { size, bg, color, fs, border } = opts;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="center" valign="middle" width="${size}" height="${size}" style="width:${size}px;height:${size}px;background:${bg};border-radius:${Math.round(size / 2)}px;${border ? `border:${border};` : ''}font-family:${FONT};font-size:${fs}px;line-height:${size}px;color:${color};text-align:center;">${glyph}</td>
  </tr></table>`;
}

function divider(marginTop = 32, marginBottom = 32): string {
  return `<tr><td style="padding:${marginTop}px 0 ${marginBottom}px;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.border};">&nbsp;</div></td></tr>`;
}

function spacer(h: number): string {
  return `<tr><td style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</td></tr>`;
}

/** Brand lockup: green rounded monogram + wordmark. Always renders (no image). */
function brandLockup(size: 'lg' | 'sm'): string {
  const mono = size === 'lg' ? 44 : 26;
  const wordFs = size === 'lg' ? 24 : 16;
  const monoFs = size === 'lg' ? 24 : 15;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
    <td valign="middle" style="padding-right:12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" valign="middle" width="${mono}" height="${mono}" style="width:${mono}px;height:${mono}px;background:${C.green};border-radius:${Math.round(mono * 0.28)}px;color:#fff;font-family:${FONT};font-size:${monoFs}px;font-weight:700;text-align:center;line-height:${mono}px;">M</td>
      </tr></table>
    </td>
    <td valign="middle" style="font-family:${FONT};font-size:${wordFs}px;font-weight:700;color:${C.text};letter-spacing:-0.02em;">MoneyBank&nbsp;FX</td>
  </tr></table>`;
}

/** Bulletproof black CTA button (with Outlook VML fallback). */
function button(label: string, href: string): string {
  const safeHref = esc(href || '#');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="${C.btn}" style="border-radius:12px;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:54px;v-text-anchor:middle;width:320px;" arcsize="22%" strokecolor="${C.btn}" fillcolor="${C.btn}">
    <w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;">${esc(label)}&nbsp;&rarr;</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${safeHref}" target="_blank" class="btn" style="display:inline-block;background:${C.btn};color:${C.btnText};font-family:${FONT};font-size:16px;font-weight:600;line-height:22px;text-decoration:none;padding:16px 32px;border-radius:12px;mso-padding-alt:0;">${esc(label)}&nbsp;<span style="color:#ffffff;">&rarr;</span></a>
    <!--<![endif]-->
  </td></tr></table>`;
}

/** "or" divider with two lines. */
function orDivider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:14px;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.border};">&nbsp;</div></td>
    <td width="30" style="font-family:${FONT};font-size:13px;color:${C.footer};text-align:center;">or</td>
    <td style="padding-left:14px;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.border};">&nbsp;</div></td>
  </tr></table>`;
}

/** Two-column row: circular icon + text block. Used in cards & help section. */
function iconRow(badgeHtml: string, textHtml: string, gap = 16): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="middle" width="48" style="width:48px;padding-right:${gap}px;">${badgeHtml}</td>
    <td valign="middle" style="font-family:${FONT};">${textHtml}</td>
  </tr></table>`;
}

/** Full document shell around inner content. */
function shell(preheader: string, inner: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="https://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>MoneyBank FX</title>
<!--[if mso]><style>* { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->
<style>
  body { margin:0; padding:0; background:${C.bg}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
  .btn:hover { background:${C.btn === '#111827' ? '#1F2937' : C.btn} !important; }
  @media only screen and (max-width:620px) {
    .card { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .px { padding-left:24px !important; padding-right:24px !important; }
    .h1 { font-size:28px !important; line-height:34px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" class="card" width="620" cellpadding="0" cellspacing="0" border="0" style="width:620px;max-width:620px;background:${C.card};border:1px solid ${C.cardBorder};border-radius:18px;box-shadow:0 1px 3px rgba(15,23,42,0.04),0 12px 32px rgba(15,23,42,0.06);overflow:hidden;">
      <tr><td class="px" style="padding:40px 48px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${inner}
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Shared header (brand + divider). */
function header(): string {
  return `<tr><td align="center" style="padding-bottom:8px;">${brandLockup('lg')}</td></tr>
  ${divider(28, 8)}`;
}

/** Shared footer (brand row + copyright). */
function footer(): string {
  return `${divider(32, 24)}
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td valign="middle" style="padding-right:10px;">${badge('&#127760;', { size: 26, bg: C.greyBg, color: C.grey, fs: 13 })}</td>
      <td valign="middle" style="font-family:${FONT};text-align:left;">
        <div style="font-size:14px;font-weight:700;color:${C.text};">MoneyBank FX</div>
        <div style="font-size:12px;color:${C.footer};">Trade Copier Platform</div>
      </td>
    </tr></table>
  </td></tr>
  ${spacer(16)}
  <tr><td align="center" style="font-family:${FONT};font-size:13px;color:${C.footer};">&copy; 2026 MoneyBank FX. All rights reserved.</td></tr>`;
}

/** Success/hero icon: ring + big check, flanked by sparkles. */
function heroCheck(): string {
  const spark = `<span style="font-family:${FONT};color:#A7F3D0;font-size:12px;">&#10022;</span>`;
  return `<tr><td align="center" style="padding:16px 0 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td valign="middle" style="padding:0 8px 18px 0;">${spark}</td>
      <td valign="middle" align="center" width="92" height="92" style="width:92px;height:92px;background:${C.greenBg};border:1px solid ${C.greenBorder};border-radius:46px;text-align:center;font-family:${FONT};font-size:44px;line-height:92px;color:${C.green};">&#10003;</td>
      <td valign="middle" style="padding:0 0 18px 8px;">${spark}</td>
    </tr></table>
  </td></tr>`;
}

/** Warning/hero icon for alerts. */
function heroWarn(): string {
  return `<tr><td align="center" style="padding:16px 0 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td valign="middle" align="center" width="92" height="92" style="width:92px;height:92px;background:${C.amberBg};border:1px solid ${C.amberBorder};border-radius:46px;text-align:center;font-family:${FONT};font-size:42px;line-height:92px;color:${C.amber};">&#9888;</td>
    </tr></table>
  </td></tr>`;
}

function heading(title: string, subtitle: string): string {
  return `<tr><td align="center" class="h1" style="font-family:${FONT};font-size:34px;line-height:40px;font-weight:700;color:${C.text};letter-spacing:-0.02em;padding-bottom:12px;">${esc(title)}</td></tr>
  <tr><td align="center" style="font-family:${FONT};font-size:16px;line-height:24px;color:${C.sub};padding:0 8px;">${subtitle}</td></tr>`;
}

function greeting(lines: string): string {
  return `<tr><td style="font-family:${FONT};font-size:16px;line-height:24px;color:${C.body};">${lines}</td></tr>`;
}

/** Credentials card with email + password rows. */
function credentialsCard(email: string, password: string): string {
  const emailRow = iconRow(
    badge('&#9993;', { size: 44, bg: C.greenBg, color: C.green, fs: 20 }),
    `<div style="font-size:13px;color:${C.small};padding-bottom:2px;">Email</div>
     <div style="font-size:15px;font-weight:600;color:${C.green};word-break:break-all;">${esc(email)}</div>`,
  );
  const pwRow = iconRow(
    badge('&#128274;', { size: 44, bg: C.greenBg, color: C.green, fs: 19 }),
    `<div style="font-size:13px;color:${C.small};padding-bottom:2px;">Temporary Password</div>
     <div style="font-size:16px;font-weight:700;color:${C.text};font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;letter-spacing:0.02em;">${esc(password)}</div>`,
  );
  return `<tr><td style="padding-top:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.cardBorder};border-radius:14px;">
      <tr><td style="padding:20px 22px;">${emailRow}</td></tr>
      <tr><td style="padding:0 22px;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.border};">&nbsp;</div></td></tr>
      <tr><td style="padding:20px 22px;">${pwRow}</td></tr>
    </table>
  </td></tr>`;
}

/** Details card for alerts (label/value rows). */
function detailsCard(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:${i === 0 ? '18px' : '10px'} 22px ${i === rows.length - 1 ? '18px' : '10px'};font-family:${FONT};">
          <span style="display:inline-block;min-width:70px;font-size:13px;color:${C.small};">${esc(k)}</span>
          <span style="font-size:15px;color:${C.text};font-weight:600;">${esc(v)}</span>
        </td></tr>`,
    )
    .join('');
  return `<tr><td style="padding-top:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.cardBorder};border-radius:14px;">
      ${body}
    </table>
  </td></tr>`;
}

/** Green "For your security" notice. */
function securityNotice(): string {
  return `<tr><td style="padding-top:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.greenBg};border-radius:12px;">
      <tr><td style="padding:16px 18px;">${iconRow(
        badge('&#128737;', { size: 40, bg: '#D1FAE5', color: C.green, fs: 18 }),
        `<div style="font-family:${FONT};font-size:14px;font-weight:700;color:${C.greenText};padding-bottom:2px;">For your security</div>
         <div style="font-family:${FONT};font-size:14px;line-height:20px;color:#3F6212;">Please change your password after logging in and enable Two-Factor Authentication for additional security.</div>`,
        14,
      )}</td></tr>
    </table>
  </td></tr>`;
}

/** Help section (grey ? badge + heading + body). */
function helpSection(title: string, body: string): string {
  return `<tr><td>${iconRow(
    badge('?', { size: 40, bg: C.greyBg, color: C.grey, fs: 18 }),
    `<div style="font-family:${FONT};font-size:15px;font-weight:700;color:${C.text};padding-bottom:3px;">${esc(title)}</div>
     <div style="font-family:${FONT};font-size:14px;line-height:20px;color:${C.small};">${body}</div>`,
    14,
  )}</td></tr>`;
}

// ---------------------------------------------------------------------------
// Public renderers
// ---------------------------------------------------------------------------

export function resetEmail(p: { email: string; password: string; url: string | null }): RenderedEmail {
  const signIn = p.url ? `${p.url}/login` : '#';
  const inner = `
    ${header()}
    ${heroCheck()}
    ${heading('Your password has been reset', `Your MoneyBank FX account password was reset<br/>by an administrator.`)}
    ${divider(32, 28)}
    ${greeting(`<strong style="color:${C.text};">Hi,</strong><br/>Your account credentials have been updated.<br/>You can sign in using the details below.`)}
    ${spacer(20)}
    ${credentialsCard(p.email, p.password)}
    ${spacer(20)}
    ${securityNotice()}
    ${spacer(28)}
    <tr><td align="center">${button('Sign In to MoneyBank FX', signIn)}</td></tr>
    ${spacer(28)}
    <tr><td>${orDivider()}</td></tr>
    ${spacer(24)}
    ${helpSection(
      "Didn't request this?",
      "If you weren't expecting this password reset, please contact your administrator immediately or reach out to our support team.",
    )}
    ${footer()}
  `;
  return {
    subject: 'Your MoneyBank FX password was reset',
    html: shell('Your MoneyBank FX password was reset by an administrator.', inner),
    text:
      `Your password has been reset\n\n` +
      `Your MoneyBank FX account password was reset by an administrator.\n\n` +
      `Email: ${p.email}\nTemporary Password: ${p.password}\n\n` +
      (p.url ? `Sign in: ${signIn}\n\n` : '') +
      `For your security, change your password after logging in and enable Two-Factor Authentication.\n\n` +
      `Didn't request this? Contact your administrator immediately.`,
  };
}

export function inviteEmail(p: { email: string; password: string; url: string | null }): RenderedEmail {
  const signIn = p.url ? `${p.url}/login` : '#';
  const inner = `
    ${header()}
    ${heroCheck()}
    ${heading('Welcome to MoneyBank FX', `An administrator account has been created<br/>for you.`)}
    ${divider(32, 28)}
    ${greeting(`<strong style="color:${C.text};">Hi,</strong><br/>Your admin account is ready.<br/>You can sign in using the details below.`)}
    ${spacer(20)}
    ${credentialsCard(p.email, p.password)}
    ${spacer(20)}
    ${securityNotice()}
    ${spacer(28)}
    <tr><td align="center">${button('Sign In to MoneyBank FX', signIn)}</td></tr>
    ${spacer(28)}
    <tr><td>${orDivider()}</td></tr>
    ${spacer(24)}
    ${helpSection(
      "Didn't expect this?",
      "If you weren't expecting this invitation, you can safely ignore this email or contact your administrator.",
    )}
    ${footer()}
  `;
  return {
    subject: 'Your MoneyBank FX admin account',
    html: shell('An administrator account has been created for you.', inner),
    text:
      `Welcome to MoneyBank FX\n\n` +
      `An administrator account has been created for you.\n\n` +
      `Email: ${p.email}\nTemporary Password: ${p.password}\n\n` +
      (p.url ? `Sign in: ${signIn}\n\n` : '') +
      `For your security, change your password after your first sign-in.`,
  };
}

export function copyAlertEmail(p: {
  order: string;
  master: string;
  slave: string;
  url: string | null;
}): RenderedEmail {
  const monitor = p.url ? `${p.url}/dashboard/monitor` : '#';
  const inner = `
    ${header()}
    ${heroWarn()}
    ${heading('Trade copy failed', `A copy from your master account could not be<br/>applied to a slave account.`)}
    ${divider(32, 28)}
    ${greeting(`<strong style="color:${C.text};">Heads up,</strong><br/>One of your copies did not go through. Details are below.`)}
    ${spacer(20)}
    ${detailsCard([
      ['Order', p.order],
      ['Master', p.master],
      ['Slave', p.slave],
    ])}
    ${spacer(28)}
    <tr><td align="center">${button('Open Live Monitor', monitor)}</td></tr>
    ${spacer(16)}
    <tr><td align="center" style="font-family:${FONT};font-size:13px;color:${C.footer};">Further alerts for this account &amp; symbol are muted for a few minutes.</td></tr>
    ${spacer(28)}
    <tr><td>${orDivider()}</td></tr>
    ${spacer(24)}
    ${helpSection(
      'Need help?',
      'Check the connection status of the affected accounts, or reach out to your administrator if failures continue.',
    )}
    ${footer()}
  `;
  return {
    subject: `⚠️ Copy failed — ${p.order}`,
    html: shell('A trade copy could not be applied to a slave account.', inner),
    text:
      `Trade copy failed\n\n` +
      `A copy from your master account could not be applied to a slave account.\n\n` +
      `Order: ${p.order}\nMaster: ${p.master}\nSlave: ${p.slave}\n\n` +
      (p.url ? `Open Live Monitor: ${monitor}\n\n` : '') +
      `Further alerts for this account & symbol are muted for a few minutes.`,
  };
}
