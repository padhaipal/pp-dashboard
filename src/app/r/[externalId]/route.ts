// Public referral redirect — replaces the old TinyURL shortener used by
// pp-sketch. The phone number sent in the WhatsApp follow-up is the user's
// own external_id, baked into a pre-filled Hindi message addressed to
// PadhaiPal's WhatsApp number. Cap the path segment at 15 chars so a
// pathological /r/<huge-string> can't grow the message arbitrarily.
const WA_DEST = '918528097842';
const HINDI_TEMPLATE =
  'पढ़ना सीखना शुरू करने के लिए कृपया एक टेक्स्ट मैसेज भेजें। {phonenumber} ने आपको रेफर किया है। अगर आप चाहते हैं कि हमें इस बात का पता चले, तो अपने टेक्स्ट मैसेज में उनका नंबर ज़रूर शामिल करें।';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ externalId: string }> },
): Promise<Response> {
  const { externalId } = await params;
  const safeId = externalId.slice(0, 15);
  const text = HINDI_TEMPLATE.replace('{phonenumber}', safeId);
  const url = `https://wa.me/${WA_DEST}?text=${encodeURIComponent(text)}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      'Cache-Control': 'no-store',
    },
  });
}
