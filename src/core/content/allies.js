// Summoned allies (ADR-0005 section 3, archetype `summon`). Data only. figureKey is the sprite key the renderer needs (R4 contract section 5).
// speed is a share of the hero's pace (0 = never moves); sight is how far the ally looks for a monster to fight.
export const allyUnits = {
  intern: { id: "intern", name: "Summer Intern", figureKey: "ally.intern", speed: 1, sight: 9, attackTicks: 40, hitTick: 14 },
  cone: { id: "cone", name: "Traffic Cone", figureKey: "ally.cone", speed: 0, sight: 0, attackTicks: 0, hitTick: 0 },
};
