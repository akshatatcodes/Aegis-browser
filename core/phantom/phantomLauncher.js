/**
 * core/phantom/phantomLauncher.js
 * 
 * Manages the creation and launching of decoy "phantom" clones.
 * Each clone follows a unique circuit and is staggered in time.
 */

'use strict';

const routingBrain = require('../routing/routingBrain');
const onionCipher = require('../encryption/onionCipher');

class PhantomLauncher {
  /**
   * Generates N decoy clones for a destination.
   * returns Array<{ circuit, delayMs }>
   */
  prepareClones(nodes, count = 3) {
    const clones = [];
    const usedEntryNodes = new Set();

    for (let i = 0; i < count; i++) {
      // 1. Build a unique circuit per clone
      // We try to pick a circuit with a DIFFERENT Entry node than others in this batch
      let circuit = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const potential = routingBrain.generateCircuit(nodes);
        if (!usedEntryNodes.has(potential.entry.id)) {
          circuit = potential;
          usedEntryNodes.add(potential.entry.id);
          break;
        }
      }
      
      if (!circuit) circuit = routingBrain.generateCircuit(nodes); // Fallback

      // 2. Randomized Stagger (100ms - 500ms)
      const delayMs = Math.floor(Math.random() * 400) + 100;

      clones.push({ circuit, delayMs });
    }

    return clones;
  }

  /**
   * Fires the phantom clones (mock implementation for Phase 5)
   */
  launch(destination, clones) {
    console.log(`\n+---------------------------------------------------+`);
    console.log(`| [PHANTOM] Obfuscating request to ${destination.padEnd(16)} |`);
    console.log(`+---------------------------------------------------+`);
    
    clones.forEach((clone, index) => {
      setTimeout(() => {
        console.log(`  > [Clone ${index + 1}] Circuit Active via ${clone.circuit.entry.region}`);
      }, clone.delayMs);
    });
  }
}

module.exports = new PhantomLauncher();
