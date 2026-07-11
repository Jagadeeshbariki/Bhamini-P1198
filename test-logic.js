const isFixed = (activityLower) => ['ns', 'byp-ns', 'bfe', 'byp-bfe', 'goatery', 'goat shed', 'eco-farmpond', 'eco farmpond'].includes(activityLower);
const isDistActivity = (activityLower) => ['processing hubs', 'asc', 'mobile irr', 'fixed irrig', 'fisheries'].includes(activityLower) || activityLower.includes('irrigation');

console.log("fixed:", isFixed('goatery'));
console.log("dist:", isDistActivity('processing hubs'));
