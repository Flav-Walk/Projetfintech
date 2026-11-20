/**
 * Abstraction du prestataire de paiement. Seule l'implémentation simulée existe :
 * aucune collecte réelle. Un futur prestataire (Stripe Connect, Mangopay, Lemonway…)
 * implémentera la même interface, et confirmera via webhook -> contribution_settle.
 */
export interface ChargeRequest {
  contributionId: string;
  amountCents: number;
  simulate?: 'success' | 'failure';
}

export interface ChargeResult {
  success: boolean;
  providerRef: string;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated';

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const providerRef = `sim_${req.contributionId.slice(0, 8)}_${Date.now().toString(36)}`;
    if (req.simulate === 'failure') {
      return { success: false, providerRef, failureReason: 'Paiement refusé (simulation).' };
    }
    return { success: true, providerRef };
  }
}
