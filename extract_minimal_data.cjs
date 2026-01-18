/**
 * Extract minimal data needed for the hardcoded scrolling explainer
 * Run with: node extract_minimal_data.js > minimal_data.js
 */

const fs = require('fs');
const path = require('path');

// Load all data files
const alphabetisationBiasAll = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/alphabetisation_bias_all_converged.json'), 'utf8')
);
const alphabetisationBiasDiffered = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/alphabetisation_bias_differed_in_control.json'), 'utf8')
);
const biasControlledResults = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/bias_controlled_results.json'), 'utf8')
);

// Model ID lists (matching the JSX file)
const demoModelIds = [
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'claude-opus-4.1', 'claude-opus-4.5', 'deepseek-v3',
  'deepseek-v3.2-exp-thinking', 'claude-haiku-4.5-thinking', 'claude-opus-4.5-thinking'
];

const allModelIds = [
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'claude-opus-4.1', 'claude-opus-4.1-valid', 'claude-opus-4.5', 'claude-sonnet-4.5', 'claude-sonnet-4.5-valid',
  'deepseek-v3', 'deepseek-v3.2-exp', 'claude-haiku-4.5',
  'deepseek-v3.2-exp-thinking', 'claude-haiku-4.5-thinking', 'claude-opus-4.5-thinking'
];

// For final summary graph - excludes haiku-thinking and deepseek-thinking
const finalSummaryModelIds = allModelIds.filter(id =>
  id !== 'claude-haiku-4.5-thinking' && id !== 'deepseek-v3.2-exp-thinking'
);

const additiveModelIds = [
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'claude-opus-4.1-valid', 'claude-opus-4.5',
  'deepseek-v3',
  'deepseek-v3.2-exp-thinking', 'claude-haiku-4.5-thinking', 'claude-opus-4.5-thinking'
];

// ============================================
// 1. Extract alphabetisationBiasData
// ============================================
// Need all demoModelIds plus -valid variants for opus-4.1 and sonnet-4.5
const neededAlphabetisationIds = new Set([
  ...demoModelIds,
  'claude-opus-4.1-valid',
  'claude-sonnet-4.5-valid'
]);

// First get the base data
const alphabetisationBase = alphabetisationBiasAll.results.filter(d =>
  neededAlphabetisationIds.has(d.model_id) || demoModelIds.includes(d.model_id)
);

// Create -valid variants for models with invalid responses
const alphabetisationBiasData = [...alphabetisationBase];
for (const model of alphabetisationBase) {
  if (model.invalid_responses && model.invalid_responses > 0) {
    const differed = alphabetisationBiasDiffered.results.find(d => d.model_id === model.model_id);
    if (!differed) continue;

    const invalidFromDiffered = model.control_differed_n - differed.n_differed_in_control;
    const invalidFromConverged = model.invalid_responses - invalidFromDiffered;
    const validControlConverged = model.control_converged_n - invalidFromConverged;
    const validControlDiffered = differed.n_differed_in_control;
    const validTotalPairs = model.total_pairs - model.invalid_responses;
    const controlConvergedSalientRatio = model.control_converged_n > 0
      ? model.control_converged_on_salient / model.control_converged_n : 0;
    const controlDifferedFirstRatio = model.control_differed_n > 0
      ? model.control_differed_both_first / model.control_differed_n : 0;

    alphabetisationBiasData.push({
      ...model,
      model_id: `${model.model_id}-valid`,
      model_name: `${model.model_name} (excl. invalid)`,
      total_pairs: validTotalPairs,
      control_converged_n: validControlConverged,
      control_converged_on_salient: Math.round(validControlConverged * controlConvergedSalientRatio),
      control_converged_on_alphabetical: Math.round(validControlConverged * (1 - controlConvergedSalientRatio)),
      control_differed_n: validControlDiffered,
      control_differed_both_first: Math.round(validControlDiffered * controlDifferedFirstRatio),
      control_differed_both_second: Math.round(validControlDiffered * (1 - controlDifferedFirstRatio)),
      coordination_converged_n: model.coordination_converged_n,
      coordination_converged_on_salient: model.coordination_converged_on_salient,
      coordination_converged_on_alphabetical: model.coordination_converged_on_alphabetical,
      coordination_differed_n: model.coordination_differed_n,
      coordination_differed_both_first: model.coordination_differed_both_first,
      coordination_differed_both_second: model.coordination_differed_both_second,
      invalid_responses: 0,
      excludes_invalid: true
    });
  }
}

// ============================================
// 2. Extract additiveCoordinationData
// ============================================
// Need to join differed data with all-converged data to get control_converged
const additiveCoordinationData = [];
for (const d of alphabetisationBiasDiffered.results) {
  if (!additiveModelIds.includes(d.model_id)) continue;

  // Find matching converged data to get control_converged
  const converged = alphabetisationBiasAll.results.find(c => c.model_id === d.model_id);
  const control_converged = converged?.control_converged_n || 0;

  additiveCoordinationData.push({
    model_id: d.model_id,
    model_name: d.model_name,
    control_converged,
    control_differed: d.n_differed_in_control,
    coord_pct: d.coord_total_converged_pct,
    coord_ci: d.coord_converged_ci,
    to_salient: d.coord_converged_on_salient,
    to_alpha: d.coord_converged_on_alphabetical,
    to_first: d.coord_differed_both_first,
    to_second: d.coord_differed_both_second,
    is_thinking: d.is_reasoning
  });

  // Add "excl. invalid" variant if there are invalid responses
  if (d.invalid_responses > 0 && additiveModelIds.includes(`${d.model_id}-valid`)) {
    const validDiffered = d.n_differed_in_control - d.invalid_responses;
    const validConvergedPct = (d.coord_total_converged / validDiffered * 100);
    additiveCoordinationData.push({
      model_id: `${d.model_id}-valid`,
      model_name: `${d.model_name} (excl. invalid)`,
      control_converged,
      control_differed: validDiffered,
      coord_pct: validConvergedPct,
      coord_ci: d.coord_converged_ci,
      to_salient: d.coord_converged_on_salient,
      to_alpha: d.coord_converged_on_alphabetical,
      to_first: d.coord_differed_both_first,
      to_second: d.coord_differed_both_second,
      excludes_invalid: true,
      is_thinking: d.is_reasoning
    });
  }
}

// ============================================
// 3. Extract biasControlledData (for final summary)
// ============================================
const biasControlledData = biasControlledResults.results
  .filter(d =>
    d.dataset !== 'weighted_average' &&
    finalSummaryModelIds.includes(d.model_id)
  )
  .map(d => ({
    model_id: d.model_id,
    model_name: d.model_name,
    dataset: d.dataset,
    coordination_pct: d.coordination_pct,
    coordination_ci: d.coordination_ci,
    is_reasoning: d.is_reasoning
  }));

// ============================================
// Output
// ============================================
console.log('// ============================================');
console.log('// HARDCODED DATA - Auto-generated');
console.log('// ============================================');
console.log('');
console.log('const alphabetisationBiasData = ' + JSON.stringify(alphabetisationBiasData, null, 2) + ';');
console.log('');
console.log('const additiveCoordinationData = ' + JSON.stringify(additiveCoordinationData, null, 2) + ';');
console.log('');
console.log('const biasControlledData = ' + JSON.stringify(biasControlledData, null, 2) + ';');
console.log('');

// Print stats
console.error('\n--- Stats ---');
console.error(`alphabetisationBiasData: ${alphabetisationBiasData.length} records`);
console.error(`additiveCoordinationData: ${additiveCoordinationData.length} records`);
console.error(`biasControlledData: ${biasControlledData.length} records`);
console.error(`Total output size: ~${Math.round((JSON.stringify(alphabetisationBiasData).length + JSON.stringify(additiveCoordinationData).length + JSON.stringify(biasControlledData).length) / 1024)}KB`);
