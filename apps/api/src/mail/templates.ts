/**
 * Production email templates — table-based, inline-CSS, email-client safe
 * (Gmail, Apple Mail, Outlook, Yahoo, mobile). Shared design system:
 * #F8FAFC canvas, centered 600px white card, Inter/system fonts, brand-green
 * accent + CTAs. Header shows the hosted MoneyBank FX logo when an app URL is
 * available, and degrades to a green "M" monogram when images are blocked.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const C = {
  text: '#0F172A',
  sub: '#475569',
  body: '#334155',
  small: '#64748B',
  footer: '#94A3B8',
  border: '#E2E8F0',
  cardBorder: '#E5E9F0',
  bg: '#F1F5F9',
  card: '#FFFFFF',
  panel: '#F8FAFC',
  green: '#1F7357', // brand-600
  greenHover: '#1A5C47', // brand-700
  greenText: '#15803D',
  greenBg: '#ECFDF5',
  greenBorder: '#BBF7D0',
  amber: '#B45309',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  grey: '#64748B',
  greyBg: '#F1F5F9',
};

const FONT =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

function esc(s: string): string {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

/** Circular icon badge (a cell with a glyph). Degrades to a square in Outlook. */
function badge(
  glyph: string,
  opts: { size: number; bg: string; color: string; fs: number; border?: string },
): string {
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

/**
 * Brand lockup: hosted logo (when available) + wordmark. Falls back to a green
 * "M" monogram so the brand always renders even with images disabled.
 */
function brandLockup(logoUrl: string | null): string {
  const mark = logoUrl
    ? `<img src="${esc(logoUrl)}" width="40" height="40" alt="MoneyBank FX" style="display:block;width:40px;height:40px;border:0;outline:none;" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" valign="middle" width="40" height="40" style="width:40px;height:40px;background:${C.green};border-radius:11px;color:#fff;font-family:${FONT};font-size:22px;font-weight:700;text-align:center;line-height:40px;">M</td>
      </tr></table>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
    <td valign="middle" style="padding-right:12px;">${mark}</td>
    <td valign="middle" style="font-family:${FONT};font-size:20px;font-weight:700;color:${C.text};letter-spacing:-0.02em;">MoneyBank&nbsp;FX</td>
  </tr></table>`;
}

/** Bulletproof brand-green CTA button (with Outlook VML fallback). */
function button(label: string, href: string): string {
  const safeHref = esc(href || '#');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="cta" style="margin:0 auto;"><tr><td align="center" bgcolor="${C.green}" style="border-radius:12px;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="23%" strokecolor="${C.green}" fillcolor="${C.green}">
    <w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;">${esc(label)}&nbsp;&rarr;</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${safeHref}" target="_blank" class="btn" style="display:inline-block;background:${C.green};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;line-height:22px;text-decoration:none;padding:15px 32px;border-radius:12px;mso-padding-alt:0;">${esc(label)}&nbsp;<span style="color:#ffffff;">&rarr;</span></a>
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

/** Two-column row: icon + text block. */
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
  .btn:hover { background:${C.greenHover} !important; }
  @media only screen and (max-width:600px) {
    .card { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    .h1 { font-size:26px !important; line-height:32px !important; }
    /* Full-width, easy-to-tap CTA on phones */
    .cta { width:100% !important; }
    .cta a { display:block !important; text-align:center !important; padding-left:0 !important; padding-right:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.card};border:1px solid ${C.cardBorder};border-radius:18px;box-shadow:0 1px 3px rgba(15,23,42,0.04),0 12px 32px rgba(15,23,42,0.06);overflow:hidden;">
      <tr><td class="px" style="padding:40px 44px;">
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

function header(logoUrl: string | null): string {
  return `<tr><td align="center" style="padding-bottom:8px;">${brandLockup(logoUrl)}</td></tr>
  ${divider(24, 8)}`;
}

function footer(url: string | null): string {
  const linkRow = url
    ? `${spacer(14)}
       <tr><td align="center" style="font-family:${FONT};font-size:13px;color:${C.small};">
         <a href="${esc(url)}" target="_blank" style="color:${C.green};font-weight:600;">${esc(url.replace(/^https?:\/\//, ''))}</a>
       </td></tr>`
    : '';
  return `${divider(32, 20)}
  <tr><td align="center" style="font-family:${FONT};font-size:14px;font-weight:700;color:${C.text};">MoneyBank FX</td></tr>
  <tr><td align="center" style="font-family:${FONT};font-size:12px;color:${C.footer};padding-top:2px;">MT4 &amp; MT5 Trade Copier Platform</td></tr>
  ${linkRow}
  ${spacer(14)}
  <tr><td align="center" style="font-family:${FONT};font-size:12px;color:${C.footer};">This is an automated message — please do not reply.</td></tr>
  <tr><td align="center" style="font-family:${FONT};font-size:12px;color:${C.footer};padding-top:4px;">&copy; 2026 MoneyBank FX. All rights reserved.</td></tr>`;
}

/** Success/hero icon: ring + big check. */
function heroCheck(): string {
  return `<tr><td align="center" style="padding:12px 0 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td valign="middle" align="center" width="84" height="84" style="width:84px;height:84px;background:${C.greenBg};border-radius:42px;text-align:center;font-family:${FONT};font-size:40px;line-height:84px;color:${C.green};">&#10003;</td>
    </tr></table>
  </td></tr>`;
}

/** Warning/hero icon for alerts. */
function heroWarn(): string {
  return `<tr><td align="center" style="padding:12px 0 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
      <td valign="middle" align="center" width="84" height="84" style="width:84px;height:84px;background:${C.amberBg};border-radius:42px;text-align:center;font-family:${FONT};font-size:38px;line-height:84px;color:${C.amber};">&#9888;</td>
    </tr></table>
  </td></tr>`;
}

function heading(title: string, subtitle: string): string {
  return `<tr><td align="center" class="h1" style="font-family:${FONT};font-size:30px;line-height:36px;font-weight:700;color:${C.text};letter-spacing:-0.02em;padding-bottom:10px;">${esc(title)}</td></tr>
  <tr><td align="center" style="font-family:${FONT};font-size:15px;line-height:23px;color:${C.sub};padding:0 8px;">${subtitle}</td></tr>`;
}

function greeting(lines: string): string {
  return `<tr><td style="font-family:${FONT};font-size:15px;line-height:23px;color:${C.body};">${lines}</td></tr>`;
}

/** Credentials card with email + password rows. */
function credentialsCard(email: string, password: string): string {
  const emailRow = iconRow(
    badge('&#9993;', { size: 44, bg: C.greenBg, color: C.green, fs: 20 }),
    `<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:${C.small};padding-bottom:3px;">Email</div>
     <div style="font-size:15px;font-weight:600;color:${C.text};word-break:break-all;">${esc(email)}</div>`,
  );
  const pwRow = iconRow(
    badge('&#128273;', { size: 44, bg: C.greenBg, color: C.green, fs: 19 }),
    `<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:${C.small};padding-bottom:3px;">Temporary password</div>
     <div style="font-size:16px;font-weight:700;color:${C.text};font-family:${MONO};letter-spacing:0.02em;">${esc(password)}</div>`,
  );
  return `<tr><td style="padding-top:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.cardBorder};border-radius:14px;">
      <tr><td style="padding:18px 20px;">${emailRow}</td></tr>
      <tr><td style="padding:0 20px;"><div style="height:1px;line-height:1px;font-size:1px;background:${C.border};">&nbsp;</div></td></tr>
      <tr><td style="padding:18px 20px;">${pwRow}</td></tr>
    </table>
  </td></tr>`;
}

/** Details card for alerts (label/value rows). */
function detailsCard(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:${i === 0 ? '16px' : '11px'} 20px ${i === rows.length - 1 ? '16px' : '11px'};font-family:${FONT};">
          <span style="display:inline-block;min-width:84px;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:${C.small};">${esc(k)}</span>
          <span style="font-size:15px;color:${C.text};font-weight:600;">${esc(v)}</span>
        </td></tr>`,
    )
    .join('');
  return `<tr><td style="padding-top:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.cardBorder};border-radius:14px;">
      ${body}
    </table>
  </td></tr>`;
}

/** Green "For your security" notice. */
function securityNotice(): string {
  return `<tr><td style="padding-top:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.greenBg};border:1px solid ${C.greenBorder};border-radius:12px;">
      <tr><td style="padding:15px 18px;">${iconRow(
        badge('&#128737;', { size: 38, bg: '#D1FAE5', color: C.green, fs: 17 }),
        `<div style="font-family:${FONT};font-size:14px;font-weight:700;color:${C.greenText};padding-bottom:2px;">Keep your account secure</div>
         <div style="font-family:${FONT};font-size:13px;line-height:19px;color:#3F6212;">Change this temporary password right after you sign in, and never share it with anyone.</div>`,
        14,
      )}</td></tr>
    </table>
  </td></tr>`;
}

/** Help section (grey ? badge + heading + body). */
function helpSection(title: string, body: string): string {
  return `<tr><td>${iconRow(
    badge('?', { size: 38, bg: C.greyBg, color: C.grey, fs: 17 }),
    `<div style="font-family:${FONT};font-size:14px;font-weight:700;color:${C.text};padding-bottom:3px;">${esc(title)}</div>
     <div style="font-family:${FONT};font-size:13px;line-height:19px;color:${C.small};">${body}</div>`,
    14,
  )}</td></tr>`;
}

const logoOf = (url: string | null): string | null => (url ? `${url}/logo.png` : null);

// ---------------------------------------------------------------------------
// Public renderers
// ---------------------------------------------------------------------------

export function resetEmail(p: { email: string; password: string; url: string | null }): RenderedEmail {
  const signIn = p.url ? `${p.url}/login` : '#';
  const inner = `
    ${header(logoOf(p.url))}
    ${heroCheck()}
    ${heading('Your password has been reset', 'An administrator has reset the password for your<br/>MoneyBank FX account.')}
    ${divider(28, 24)}
    ${greeting(`Hello,<br/>Your account credentials have been updated. Use the temporary password below to sign in.`)}
    ${spacer(18)}
    ${credentialsCard(p.email, p.password)}
    ${spacer(18)}
    ${securityNotice()}
    ${spacer(26)}
    <tr><td align="center">${button('Sign in to your account', signIn)}</td></tr>
    ${spacer(26)}
    <tr><td>${orDivider()}</td></tr>
    ${spacer(22)}
    ${helpSection(
      "Didn't request this?",
      "If you weren't expecting this change, contact your administrator immediately — your account may need attention.",
    )}
    ${footer(p.url)}
  `;
  return {
    subject: 'Your MoneyBank FX password has been reset',
    html: shell('An administrator reset your MoneyBank FX password. Sign in with your new temporary password.', inner),
    text:
      `Your password has been reset\n\n` +
      `An administrator has reset the password for your MoneyBank FX account.\n\n` +
      `Email: ${p.email}\nTemporary password: ${p.password}\n\n` +
      (p.url ? `Sign in: ${signIn}\n\n` : '') +
      `For your security, change this temporary password right after you sign in.\n\n` +
      `Didn't request this? Contact your administrator immediately.`,
  };
}

export function inviteEmail(p: { email: string; password: string; url: string | null }): RenderedEmail {
  const signIn = p.url ? `${p.url}/login` : '#';
  const inner = `
    ${header(logoOf(p.url))}
    ${heroCheck()}
    ${heading('Welcome to MoneyBank FX', 'An administrator account has been created for you.')}
    ${divider(28, 24)}
    ${greeting(`Hello,<br/>Your administrator account is ready. Sign in with the temporary credentials below to get started.`)}
    ${spacer(18)}
    ${credentialsCard(p.email, p.password)}
    ${spacer(18)}
    ${securityNotice()}
    ${spacer(26)}
    <tr><td align="center">${button('Sign in to get started', signIn)}</td></tr>
    ${spacer(26)}
    <tr><td>${orDivider()}</td></tr>
    ${spacer(22)}
    ${helpSection(
      "Didn't expect this?",
      "If you weren't expecting this invitation, you can safely ignore this email or let your administrator know.",
    )}
    ${footer(p.url)}
  `;
  return {
    subject: 'Your MoneyBank FX admin account is ready',
    html: shell('An administrator account has been created for you on MoneyBank FX.', inner),
    text:
      `Welcome to MoneyBank FX\n\n` +
      `An administrator account has been created for you.\n\n` +
      `Email: ${p.email}\nTemporary password: ${p.password}\n\n` +
      (p.url ? `Sign in: ${signIn}\n\n` : '') +
      `For your security, change this temporary password after your first sign-in.`,
  };
}

export function copyAlertEmail(p: {
  order: string;
  master: string; // source account label (kept for signature compatibility)
  slave: string; // receiver account label
  url: string | null;
}): RenderedEmail {
  const monitor = p.url ? `${p.url}/dashboard/monitor` : '#';
  const inner = `
    ${header(logoOf(p.url))}
    ${heroWarn()}
    ${heading('A trade copy failed', 'A trade from your source account could not be<br/>copied to a receiver account.')}
    ${divider(28, 24)}
    ${greeting(`Heads up,<br/>One of your copies didn't go through. The details are below.`)}
    ${spacer(18)}
    ${detailsCard([
      ['Trade', p.order],
      ['Source', p.master],
      ['Receiver', p.slave],
    ])}
    ${spacer(26)}
    <tr><td align="center">${button('Open live monitor', monitor)}</td></tr>
    ${spacer(14)}
    <tr><td align="center" style="font-family:${FONT};font-size:13px;color:${C.footer};">Further alerts for this account &amp; symbol are muted for a few minutes.</td></tr>
    ${spacer(26)}
    <tr><td>${orDivider()}</td></tr>
    ${spacer(22)}
    ${helpSection(
      'What to check',
      'Confirm both accounts are connected and the receiver uses a trade-enabled password. Contact your administrator if failures continue.',
    )}
    ${footer(p.url)}
  `;
  return {
    subject: `Trade copy failed — ${p.order}`,
    html: shell('A trade from your source account could not be copied to a receiver account.', inner),
    text:
      `A trade copy failed\n\n` +
      `A trade from your source account could not be copied to a receiver account.\n\n` +
      `Trade: ${p.order}\nSource: ${p.master}\nReceiver: ${p.slave}\n\n` +
      (p.url ? `Open live monitor: ${monitor}\n\n` : '') +
      `Further alerts for this account & symbol are muted for a few minutes.`,
  };
}

export function passwordResetLinkEmail(p: {
  email: string;
  url: string | null;
  resetUrl: string;
  expiresMinutes: number;
}): RenderedEmail {
  const inner = `
    ${header(logoOf(p.url))}
    ${heroCheck()}
    ${heading('Reset your password', 'We received a request to reset the password for<br/>your MoneyBank FX account.')}
    ${divider(28, 24)}
    ${greeting(`Hello,<br/>Click the button below to choose a new password. This link expires in ${p.expiresMinutes} minutes.`)}
    ${spacer(26)}
    <tr><td align="center">${button('Reset my password', p.resetUrl)}</td></tr>
    ${spacer(26)}
    <tr><td>${orDivider()}</td></tr>
    ${spacer(22)}
    ${helpSection(
      "Didn't request this?",
      "If you didn't ask to reset your password, you can safely ignore this email — your password will not change.",
    )}
    ${footer(p.url)}
  `;
  return {
    subject: 'Reset your MoneyBank FX password',
    html: shell('Reset your MoneyBank FX password. This link expires soon.', inner),
    text:
      `Reset your password\n\n` +
      `We received a request to reset the password for your MoneyBank FX account (${p.email}).\n\n` +
      `Reset your password: ${p.resetUrl}\n\n` +
      `This link expires in ${p.expiresMinutes} minutes.\n\n` +
      `If you didn't request this, you can safely ignore this email — your password will not change.`,
  };
}
