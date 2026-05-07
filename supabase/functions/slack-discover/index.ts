// Slack token validator + real endpoint catalog provider
// POST { token: string } -> { ok, team, user, endpoints: [...] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Curated catalog of REAL Slack Web API endpoints (not invented).
// Source: https://api.slack.com/methods
const SLACK_ENDPOINTS = [
  // Messaging
  { method: "POST", path: "/chat.postMessage", name: "Send message", description: "Sends a message to a channel.", scopes: ["chat:write"] },
  { method: "POST", path: "/chat.postEphemeral", name: "Send ephemeral message", description: "Sends an ephemeral message visible only to one user.", scopes: ["chat:write"] },
  { method: "POST", path: "/chat.update", name: "Update message", description: "Updates a message.", scopes: ["chat:write"] },
  { method: "POST", path: "/chat.delete", name: "Delete message", description: "Deletes a message.", scopes: ["chat:write"] },
  { method: "POST", path: "/chat.scheduleMessage", name: "Schedule message", description: "Schedules a message to be sent later.", scopes: ["chat:write"] },
  { method: "GET",  path: "/chat.getPermalink", name: "Get message permalink", description: "Retrieve a permalink URL for a specific message.", scopes: [] },

  // Conversations / channels
  { method: "GET",  path: "/conversations.list", name: "List channels", description: "Lists all channels in the workspace.", scopes: ["channels:read", "groups:read", "im:read", "mpim:read"] },
  { method: "GET",  path: "/conversations.info", name: "Get channel info", description: "Retrieve information about a conversation.", scopes: ["channels:read", "groups:read", "im:read", "mpim:read"] },
  { method: "GET",  path: "/conversations.history", name: "Get channel history", description: "Fetches a conversation's history of messages and events.", scopes: ["channels:history", "groups:history", "im:history", "mpim:history"] },
  { method: "GET",  path: "/conversations.replies", name: "Get thread replies", description: "Retrieve a thread of messages posted to a conversation.", scopes: ["channels:history", "groups:history", "im:history", "mpim:history"] },
  { method: "GET",  path: "/conversations.members", name: "List channel members", description: "Retrieve members of a conversation.", scopes: ["channels:read", "groups:read", "im:read", "mpim:read"] },
  { method: "POST", path: "/conversations.create", name: "Create channel", description: "Initiates a public or private channel-based conversation.", scopes: ["channels:manage", "groups:write"] },
  { method: "POST", path: "/conversations.invite", name: "Invite users to channel", description: "Invites users to a channel.", scopes: ["channels:manage", "groups:write"] },
  { method: "POST", path: "/conversations.join", name: "Join channel", description: "Joins an existing conversation.", scopes: ["channels:write.invites", "channels:manage"] },
  { method: "POST", path: "/conversations.leave", name: "Leave channel", description: "Leaves a conversation.", scopes: ["channels:write", "groups:write"] },
  { method: "POST", path: "/conversations.archive", name: "Archive channel", description: "Archives a conversation.", scopes: ["channels:manage", "groups:write"] },
  { method: "POST", path: "/conversations.rename", name: "Rename channel", description: "Renames a conversation.", scopes: ["channels:manage", "groups:write"] },
  { method: "POST", path: "/conversations.setTopic", name: "Set channel topic", description: "Sets the topic for a conversation.", scopes: ["channels:manage", "groups:write"] },
  { method: "POST", path: "/conversations.setPurpose", name: "Set channel purpose", description: "Sets the purpose for a conversation.", scopes: ["channels:manage", "groups:write"] },
  { method: "POST", path: "/conversations.open", name: "Open DM/MPIM", description: "Opens or resumes a direct message or multi-person direct message.", scopes: ["im:write", "mpim:write"] },

  // Users
  { method: "GET",  path: "/users.list", name: "List users", description: "Lists all users in a Slack team.", scopes: ["users:read"] },
  { method: "GET",  path: "/users.info", name: "Get user info", description: "Gets information about a user.", scopes: ["users:read"] },
  { method: "GET",  path: "/users.lookupByEmail", name: "Lookup user by email", description: "Find a user with an email address.", scopes: ["users:read.email"] },
  { method: "GET",  path: "/users.getPresence", name: "Get user presence", description: "Gets user presence information.", scopes: ["users:read"] },
  { method: "POST", path: "/users.setPresence", name: "Set user presence", description: "Manually sets user presence.", scopes: ["users:write"] },
  { method: "GET",  path: "/users.profile.get", name: "Get user profile", description: "Retrieves a user's profile information.", scopes: ["users.profile:read"] },
  { method: "POST", path: "/users.profile.set", name: "Set user profile", description: "Set a user's profile information.", scopes: ["users.profile:write"] },

  // Files
  { method: "POST", path: "/files.getUploadURLExternal", name: "Get external upload URL", description: "Gets a URL for an upload (step 1 of the modern upload flow).", scopes: ["files:write"] },
  { method: "POST", path: "/files.completeUploadExternal", name: "Complete external upload", description: "Finishes an upload started via getUploadURLExternal (step 2).", scopes: ["files:write"] },
  { method: "GET",  path: "/files.list", name: "List files", description: "List & filter team files.", scopes: ["files:read"] },
  { method: "GET",  path: "/files.info", name: "Get file info", description: "Gets information about a file.", scopes: ["files:read"] },
  { method: "POST", path: "/files.delete", name: "Delete file", description: "Deletes a file.", scopes: ["files:write"] },

  // Reactions / pins / bookmarks
  { method: "POST", path: "/reactions.add", name: "Add reaction", description: "Adds a reaction to an item.", scopes: ["reactions:write"] },
  { method: "POST", path: "/reactions.remove", name: "Remove reaction", description: "Removes a reaction from an item.", scopes: ["reactions:write"] },
  { method: "POST", path: "/pins.add", name: "Pin item", description: "Pins an item to a channel.", scopes: ["pins:write"] },
  { method: "POST", path: "/pins.remove", name: "Unpin item", description: "Un-pins an item from a channel.", scopes: ["pins:write"] },
  { method: "GET",  path: "/bookmarks.list", name: "List bookmarks", description: "List bookmarks for a channel.", scopes: ["bookmarks:read"] },
  { method: "POST", path: "/bookmarks.add", name: "Add bookmark", description: "Add a bookmark to a channel.", scopes: ["bookmarks:write"] },

  // Search (user tokens only)
  { method: "GET",  path: "/search.messages", name: "Search messages", description: "Searches for messages matching a query (user token required).", scopes: ["search:read"] },

  // Workspace / team
  { method: "GET",  path: "/team.info", name: "Get team info", description: "Gets information about the current team.", scopes: ["team:read"] },
  { method: "GET",  path: "/auth.test", name: "Test authentication", description: "Checks authentication & identity.", scopes: [] },

  // Views (modals / Home tab)
  { method: "POST", path: "/views.open", name: "Open modal view", description: "Open a view for a user.", scopes: [] },
  { method: "POST", path: "/views.update", name: "Update modal view", description: "Update an existing view.", scopes: [] },
  { method: "POST", path: "/views.publish", name: "Publish home view", description: "Publish a static view for a user (Home tab).", scopes: [] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return json({ ok: false, error: "Missing token" }, 400);
    }

    // Validate token via auth.test (works for bot & user tokens)
    const authRes = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const authData = await authRes.json();

    if (!authData.ok) {
      return json({
        ok: false,
        error: authData.error || "Invalid token",
        hint: "Vérifiez que le token commence par xoxb- (bot) ou xoxp- (user) et qu'il est actif.",
      }, 200);
    }

    // Try to extract granted scopes from response headers (Slack returns x-oauth-scopes)
    const scopesHeader = authRes.headers.get("x-oauth-scopes") || "";
    const grantedScopes = scopesHeader
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Annotate endpoints with availability
    const endpoints = SLACK_ENDPOINTS.map((ep) => {
      const required = ep.scopes || [];
      const available =
        required.length === 0 ||
        grantedScopes.length === 0 || // unknown scopes -> show all
        required.some((s) => grantedScopes.includes(s));
      return { ...ep, available };
    });

    return json({
      ok: true,
      team: authData.team,
      team_id: authData.team_id,
      user: authData.user,
      user_id: authData.user_id,
      bot_id: authData.bot_id,
      url: authData.url,
      granted_scopes: grantedScopes,
      endpoints,
    }, 200);
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Unknown error" }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
