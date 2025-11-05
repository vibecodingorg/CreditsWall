export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ tasks: [], rewards: [] }), { headers: { 'content-type': 'application/json' } });
};
