/**
 * Contract Relations — Bidirectional linking with approval flow
 * 
 * Manages contract-to-contract relationships with cross-unit approval.
 * Extracted from contractService.ts to reduce file size.
 */

import { dataClient as supabase } from '../../lib/dataClient';

/**
 * Get all APPROVED related contracts (both directions).
 */
export const getRelatedContracts = async (contractId: string): Promise<{ id: string; contractCode: string; title: string; partyA: string; value: number; status: string; signedDate: string; unitId: string }[]> => {
    try {
        const { data: relations, error } = await supabase
            .from('contract_relations')
            .select('contract_id, related_contract_id')
            .or(`contract_id.eq.${contractId},related_contract_id.eq.${contractId}`)
            .eq('status', 'approved');

        if (error) {
            console.error('[ContractRelations] getRelatedContracts error:', error);
            return [];
        }
        if (!relations || relations.length === 0) return [];

        const relatedIds = new Set<string>();
        relations.forEach(r => {
            if (r.contract_id !== contractId) relatedIds.add(r.contract_id);
            if (r.related_contract_id !== contractId) relatedIds.add(r.related_contract_id);
        });
        if (relatedIds.size === 0) return [];

        const { data: contracts, error: fetchError } = await supabase
            .from('contracts')
            .select('id, contract_code, title, party_a, value, status, signed_date, unit_id')
            .in('id', Array.from(relatedIds));

        if (fetchError) {
            console.error('[ContractRelations] fetch related contracts error:', fetchError);
            return [];
        }

        return (contracts || []).map(c => ({
            id: c.id,
            contractCode: c.contract_code || c.id,
            title: c.title || '',
            partyA: c.party_a || '',
            value: c.value || 0,
            status: c.status || 'Processing',
            signedDate: c.signed_date || '',
            unitId: c.unit_id || '',
        }));
    } catch (e) {
        console.error('[ContractRelations] getRelatedContracts exception:', e);
        return [];
    }
};

/**
 * Get pending outgoing link requests FROM this contract (waiting for other side to approve).
 */
export const getOutgoingPendingLinks = async (contractId: string): Promise<{ id: string; contractCode: string; title: string; partyA: string; unitId: string }[]> => {
    try {
        const { data, error } = await supabase
            .from('contract_relations')
            .select('related_contract_id')
            .eq('contract_id', contractId)
            .eq('status', 'pending')
            .eq('requested_by', contractId);

        if (error || !data || data.length === 0) return [];

        const ids = data.map(r => r.related_contract_id);
        const { data: contracts } = await supabase
            .from('contracts')
            .select('id, contract_code, title, party_a, unit_id')
            .in('id', ids);

        return (contracts || []).map(c => ({
            id: c.id,
            contractCode: c.contract_code || c.id,
            title: c.title || '',
            partyA: c.party_a || '',
            unitId: c.unit_id || '',
        }));
    } catch (e) {
        console.error('[ContractRelations] getOutgoingPendingLinks error:', e);
        return [];
    }
};

/**
 * Get pending incoming link requests TO this contract (waiting for THIS side to approve).
 */
export const getIncomingPendingLinks = async (contractId: string): Promise<{ id: string; contractCode: string; title: string; partyA: string; value: number; unitId: string }[]> => {
    try {
        const { data, error } = await supabase
            .from('contract_relations')
            .select('contract_id, requested_by')
            .eq('related_contract_id', contractId)
            .eq('status', 'pending');

        if (error || !data || data.length === 0) return [];

        // The requesting contract is the contract_id (= requested_by)
        const ids = data.map(r => r.contract_id);
        const { data: contracts } = await supabase
            .from('contracts')
            .select('id, contract_code, title, party_a, value, unit_id')
            .in('id', ids);

        return (contracts || []).map(c => ({
            id: c.id,
            contractCode: c.contract_code || c.id,
            title: c.title || '',
            partyA: c.party_a || '',
            value: c.value || 0,
            unitId: c.unit_id || '',
        }));
    } catch (e) {
        console.error('[ContractRelations] getIncomingPendingLinks error:', e);
        return [];
    }
};

/**
 * Link two contracts.
 * - Same unit → instant (status = approved, both directions)
 * - Cross unit → pending (status = pending, one direction only, requested_by = contractId)
 * Returns: 'approved' | 'pending' | false
 */
export const linkContracts = async (contractId: string, relatedContractId: string): Promise<'approved' | 'pending' | false> => {
    try {
        if (contractId === relatedContractId) return false;

        // Fetch unit_id for both contracts to determine same-unit vs cross-unit
        const { data: contracts } = await supabase
            .from('contracts')
            .select('id, unit_id')
            .in('id', [contractId, relatedContractId]);

        if (!contracts || contracts.length < 2) return false;

        const unitA = contracts.find(c => c.id === contractId)?.unit_id;
        const unitB = contracts.find(c => c.id === relatedContractId)?.unit_id;
        const sameUnit = unitA && unitB && unitA === unitB;

        if (sameUnit) {
            // Same unit → instant approval, both directions
            const { error } = await supabase
                .from('contract_relations')
                .upsert([
                    { contract_id: contractId, related_contract_id: relatedContractId, status: 'approved', requested_by: contractId },
                    { contract_id: relatedContractId, related_contract_id: contractId, status: 'approved', requested_by: contractId },
                ], { onConflict: 'contract_id,related_contract_id' });

            if (error) {
                console.error('[ContractRelations] linkContracts (same-unit) error:', error);
                return false;
            }
            return 'approved';
        } else {
            // Cross unit → pending, one direction (requester → target)
            const { error } = await supabase
                .from('contract_relations')
                .upsert([
                    { contract_id: contractId, related_contract_id: relatedContractId, status: 'pending', requested_by: contractId },
                ], { onConflict: 'contract_id,related_contract_id' });

            if (error) {
                console.error('[ContractRelations] linkContracts (cross-unit) error:', error);
                return false;
            }
            return 'pending';
        }
    } catch (e) {
        console.error('[ContractRelations] linkContracts exception:', e);
        return false;
    }
};

/**
 * Approve an incoming link request. Creates the reverse direction with approved status.
 */
export const approveLink = async (contractId: string, requesterContractId: string): Promise<boolean> => {
    try {
        // Update existing pending row to approved
        const { error: e1 } = await supabase
            .from('contract_relations')
            .update({ status: 'approved' })
            .eq('contract_id', requesterContractId)
            .eq('related_contract_id', contractId)
            .eq('status', 'pending');

        // Insert reverse direction as approved
        const { error: e2 } = await supabase
            .from('contract_relations')
            .upsert([
                { contract_id: contractId, related_contract_id: requesterContractId, status: 'approved', requested_by: requesterContractId },
            ], { onConflict: 'contract_id,related_contract_id' });

        if (e1 || e2) {
            console.error('[ContractRelations] approveLink error:', e1 || e2);
            return false;
        }
        return true;
    } catch (e) {
        console.error('[ContractRelations] approveLink exception:', e);
        return false;
    }
};

/**
 * Reject (delete) an incoming link request.
 */
export const rejectLink = async (contractId: string, requesterContractId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('contract_relations')
            .delete()
            .eq('contract_id', requesterContractId)
            .eq('related_contract_id', contractId)
            .eq('status', 'pending');

        if (error) {
            console.error('[ContractRelations] rejectLink error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('[ContractRelations] rejectLink exception:', e);
        return false;
    }
};

/**
 * Unlink two approved contracts (removes both directions).
 */
export const unlinkContracts = async (contractId: string, relatedContractId: string): Promise<boolean> => {
    try {
        const { error: e1 } = await supabase
            .from('contract_relations')
            .delete()
            .eq('contract_id', contractId)
            .eq('related_contract_id', relatedContractId);

        const { error: e2 } = await supabase
            .from('contract_relations')
            .delete()
            .eq('contract_id', relatedContractId)
            .eq('related_contract_id', contractId);

        if (e1 || e2) {
            console.error('[ContractRelations] unlinkContracts error:', e1 || e2);
            return false;
        }
        return true;
    } catch (e) {
        console.error('[ContractRelations] unlinkContracts exception:', e);
        return false;
    }
};
