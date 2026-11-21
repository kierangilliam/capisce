// Put at the top of each figure's copy of the capisce page. It stands in for the server that `capisce serve`
// runs, so the page turns its comments on, keeps what the figure saves in memory, and fills its frame.
// In a narrow frame the page stacks its panels as it does on a phone; here each panel scrolls inside the frame.
(() => {
  document.documentElement.dataset.theme = "light";
  const style = document.createElement("style");
  style.textContent = `
    html.own_page body { padding: 0 !important; }
    html.own_page .capisce { height: 100vh !important; min-height: 0 !important; border-radius: 0 !important; border: 0 !important; }
    @media (max-width: 600px) {
      html.own_page .capisce .panels { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); }
      html.own_page .capisce.has_trace .panels { grid-template-rows: auto minmax(0, 1fr); }
      html.own_page .capisce .trace_panel { max-height: 42vh; }
    }
    ::selection { background: #b4d5fe; }
  `;
  document.head.append(style);

  HTMLElement.prototype.focus = function () {};

  const lists = { comments: [], notes: [] };
  let next_id = 1;
  const answer = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const real_fetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = String(input);
    const at = url.lastIndexOf("/api/");
    if (at === -1) {
      return real_fetch(input, init);
    }
    const [collection, id] = url.slice(at + "/api/".length).split("/");
    const list = lists[collection];
    if (list === undefined) {
      return answer({ error: "not here" }, 404);
    }
    const method = init.method ?? "GET";
    if (method === "GET") {
      return answer(list);
    }
    if (method === "POST" && id === undefined) {
      const saved = {
        ...JSON.parse(init.body),
        id: `${collection}_${next_id++}`,
        status: "open",
        unread: false,
        replies: [],
        created_at: new Date().toISOString(),
      };
      list.push(saved);
      return answer(saved);
    }
    return answer({});
  };
})();
