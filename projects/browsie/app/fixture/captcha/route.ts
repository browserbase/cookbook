const html = `<!doctype html><html><body><h1>Deterministic CAPTCHA event fixture</h1><button id="solve">Solve markers</button><button id="error">Error markers</button><script>
solve.onclick=()=>{console.log('browserbase-solving-started');setTimeout(()=>console.log('browserbase-solving-finished'),50)};
error.onclick=()=>{console.log('browserbase-solving-started');setTimeout(()=>console.log('browserbase-solving-errored'),50)};
</script></body></html>`;
export function GET() {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
