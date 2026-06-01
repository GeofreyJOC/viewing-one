// Cloudflare Email Worker — forwards PP listing emails to Viewing.One API
// v2 - Uses message.raw to read email body and forwards to webhook
export default {
  async email(message, env, ctx) {
    try {
      // Read the raw email content
      const reader = message.raw.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const rawBytes = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        rawBytes.set(chunk, offset);
        offset += chunk.length;
      }
      const decoder = new TextDecoder();
      const rawText = decoder.decode(rawBytes);

      // Try to extract text/plain part from MIME for cleaner content
      let textBody = rawText;
      const textPlainMatch = rawText.match(/Content-Type:\s*text\/plain[^]*?\n\n([^]*?)(?:\n--|\n$|$)/i);
      if (textPlainMatch) {
        textBody = textPlainMatch[1].trim();
      }

      // Build payload for Viewing.One
      const payload = {
        from: message.from,
        to: message.to,
        subject: message.headers.get('subject') || '',
        text: textBody
      };

      console.log('Sending to Viewing.One API');
      console.log('From:', payload.from);
      console.log('Subject:', payload.subject);
      console.log('Body length:', payload.text.length);

      // Send to Viewing.One
      const response = await fetch('https://viewing-one.vercel.app/api/properties/email-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resultText = await response.text();
      console.log('Viewing.One response status:', response.status);
      console.log('Viewing.One response body:', resultText);

      try {
        const result = JSON.parse(resultText);
        console.log('Parsed result:', JSON.stringify(result));
      } catch(parseErr) {}
      
    } catch(err) {
      console.log('Worker error:', err.message);
      console.log('Stack:', err.stack);
    }
  }
};
