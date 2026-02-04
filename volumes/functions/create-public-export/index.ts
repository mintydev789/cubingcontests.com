Deno.serve(() => {
  return new Response(`"Hello from Edge Functions!"`, { headers: { "Content-Type": "application/json" } });
});

// To invoke:
// curl 'http://localhost:<KONG_HTTP_PORT>/functions/v1/<FUNCTION>' --header 'Authorization: Bearer <anon/service_role API key>'
