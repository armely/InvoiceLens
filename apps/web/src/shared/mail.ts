import { getCurrentAccessToken } from './auth.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return character;
    }
  });
}

function buildTestEmailHtml(recipientName: string, recipientEmail: string): string {
  const title = 'InvoiceLens test email delivery';
  const accentColor = '#2563eb';
  const badgeBackground = '#dbeafe';
  const badgeForeground = '#1d4ed8';
  const issuedAt = new Date().toISOString().replace('T', ' ').replace('Z', ' UTC');

  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f4f7fb;color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f4f7fb;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:30px 36px 20px;border-top:5px solid ${accentColor};">
              <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;font-weight:700;">InvoiceLens</div>
              <div style="margin-top:12px;display:inline-block;padding:6px 10px;border-radius:999px;background:${badgeBackground};color:${badgeForeground};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Test message</div>
              <h1 style="margin:16px 0 0;font-size:26px;line-height:1.25;color:#0f172a;font-weight:700;">${escapeHtml(title)}</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#334155;">This message confirms that the signed-in Microsoft account can send a professionally formatted email from InvoiceLens.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 6px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;width:36%;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">Recipient</td>
                  <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;line-height:1.6;">${escapeHtml(recipientEmail)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;width:36%;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">Signed-in user</td>
                  <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;line-height:1.6;">${escapeHtml(recipientName)}</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;width:36%;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">Delivery path</td>
                  <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;line-height:1.6;">Microsoft Graph with the signed-in app registration</td>
                </tr>
                <tr>
                  <td style="padding:14px 0;width:36%;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">Generated at</td>
                  <td style="padding:14px 0;color:#0f172a;font-size:14px;line-height:1.6;">${escapeHtml(issuedAt)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 28px;">
              <div style="margin:0;padding:16px 18px;border-radius:12px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.6;">If you did not request this message, no action is required.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 30px;color:#94a3b8;font-size:12px;line-height:1.6;">Sent by InvoiceLens</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendMicrosoftTestEmail(recipientEmail: string, recipientName: string): Promise<void> {
  const accessToken = getCurrentAccessToken();
  if (!accessToken) {
    throw new Error('Microsoft sign-in needs to be refreshed before sending email. Sign out and sign back in so the Mail.Send permission is included in the token.');
  }

  const trimmedEmail = recipientEmail.trim();
  if (!trimmedEmail) {
    throw new Error('A recipient email address is required.');
  }

  const payload = {
    message: {
      subject: 'InvoiceLens test email delivery',
      body: {
        contentType: 'HTML',
        content: buildTestEmailHtml(recipientName.trim() || trimmedEmail, trimmedEmail),
      },
      toRecipients: [
        {
          emailAddress: {
            address: trimmedEmail,
          },
        },
      ],
    },
    saveToSentItems: false,
  };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new Error('Microsoft Graph rejected the token. Please sign out and sign back in so the Mail.Send scope can be requested again.');
    }

    if (response.status === 403) {
      throw new Error('Microsoft Graph blocked mail delivery. The app registration likely needs Mail.Send permission and admin consent.');
    }

    throw new Error(
      errorText
        ? `Microsoft Graph mail delivery failed (${response.status} ${response.statusText}): ${errorText}`
        : `Microsoft Graph mail delivery failed (${response.status} ${response.statusText}).`,
    );
  }
}
