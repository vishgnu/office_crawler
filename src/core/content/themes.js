// Floor themes. S1 has the open-plan office only (lobby and basement arrive in S2).
export const themes = {
  "open-plan": {
    id: "open-plan",
    roomKinds: ["cubicle", "conference", "copy", "storage"],
  },
};

// Every depth uses open-plan until the basement theme exists.
export const themeForDepth = () => "open-plan";
