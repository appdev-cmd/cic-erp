import { dataClient as supabase } from '../lib/dataClient';
import { supabase as authClient } from '../lib/supabase';
import { PlanStatus, UserRole } from '../types';
import { AuditLogService } from './auditLogService';

export const WorkflowService = {
    /**
     * Approve a Business Plan (PAKD)
     * transitions: Draft -> Pending_Unit -> Pending_Finance -> Pending_Board -> Approved
     */
    async approvePAKD(planId: string, currentRole: UserRole): Promise<{ success: boolean; error?: any }> {
        try {
            // 1. Get current plan status and financials for auto-approve check
            const { data: plans, error: fetchError } = await supabase
                .from('contract_business_plans')
                .select('status, contract_id, financials')
                .eq('id', planId);

            if (fetchError || !plans || plans.length === 0) {
                console.error('Plan not found:', planId);
                return { success: false, error: 'Plan not found' };
            }
            const plan = plans[0];


            let nextStatus: PlanStatus | null = null;
            const currentStatus = plan.status as PlanStatus;

            // 2. Determine next status based on Role & Current Status
            const user = (await supabase.auth.getUser()).data.user;
            const userEmail = user?.email;
            const isAdmin = currentRole === 'Admin' || currentRole === 'Leadership';

            if (isAdmin) {
                // GOD MODE: Auto-advance based on current status
                if (currentStatus === 'Draft') nextStatus = 'Pending_Unit';
                else if (currentStatus === 'Pending_Unit') nextStatus = 'Pending_Finance';
                else if (currentStatus === 'Pending_Finance') nextStatus = 'Pending_Board';
                else if (currentStatus === 'Pending_Board') nextStatus = 'Approved';
            }

            // Normal Flow Fallback
            if (!nextStatus) {
                if (currentStatus === 'Draft' && (currentRole === 'NVKD' || currentRole === 'UnitLeader' || currentRole === 'AdminUnit')) {
                    nextStatus = 'Pending_Unit';
                } else if (currentStatus === 'Pending_Unit' && (currentRole === 'UnitLeader' || currentRole === 'AdminUnit')) {
                    nextStatus = 'Pending_Finance';
                } else if (currentStatus === 'Pending_Finance' && (currentRole === 'Accountant' || currentRole === 'ChiefAccountant')) {
                    // AUTO-APPROVE CHECK: If margin >= 30% AND no expert hiring, skip Pending_Board
                    const financials = plan.financials as { margin?: number; adminCosts?: { expertHiring?: number } } | null;
                    const margin = financials?.margin || 0;
                    const expertHiring = financials?.adminCosts?.expertHiring || 0;

                    if (margin >= 30 && expertHiring === 0) {
                        nextStatus = 'Approved'; // Auto-approve, skip Board
                        console.log(`[AUTO-APPROVE] PAKD ${planId}: margin=${margin}%, expertHiring=${expertHiring} → Skipping Pending_Board`);
                    } else {
                        nextStatus = 'Pending_Board';
                        console.log(`[MANUAL] PAKD ${planId}: margin=${margin}%, expertHiring=${expertHiring} → Requires Board approval`);
                    }
                } else if (currentStatus === 'Pending_Board' && currentRole === 'Leadership') {
                    nextStatus = 'Approved';
                }
            }

            if (!nextStatus) {
                // Allow Leadership to force approve
                if (currentRole === 'Leadership' || isAdmin) nextStatus = 'Approved';
                else throw new Error(`Invalid transition for Role ${currentRole} from Status ${currentStatus}`);
            }

            const currentUser = (await supabase.auth.getUser()).data.user;

            // 3. Update Status
            const { error: updateError } = await supabase
                .from('contract_business_plans')
                .update({
                    status: nextStatus,
                    approved_by: nextStatus === 'Approved' ? currentUser?.id : undefined,
                    approved_at: nextStatus === 'Approved' ? new Date().toISOString() : undefined
                })
                .eq('id', planId);

            if (updateError) throw updateError;

            // 4. Manual Log to contract_reviews
            // Map current status to review_role enum (Unit, Finance, Legal, Board)
            const reviewRoleMap: Record<string, 'Unit' | 'Finance' | 'Legal' | 'Board'> = {
                'Draft': 'Unit',           // Submitting from Draft is Unit action
                'Pending_Unit': 'Unit',    // UnitLeader approving
                'Pending_Finance': 'Finance', // Accountant approving
                'Pending_Board': 'Board'   // Leadership approving
            };
            const reviewRole = reviewRoleMap[currentStatus] || 'Unit';

            // Determine if this was auto-approved
            const wasAutoApproved = currentStatus === 'Pending_Finance' && nextStatus === 'Approved';
            const commentText = wasAutoApproved
                ? `[TỰ ĐỘNG] Phê duyệt từ ${currentStatus} → ${nextStatus} (Margin ≥ 30%, Không thuê ngoài)`
                : `Approved from ${currentStatus} to ${nextStatus}`;

            const { error: reviewError } = await supabase.from('contract_reviews').insert({
                contract_id: plan.contract_id,
                plan_id: planId,
                reviewer_id: currentUser?.id,
                role: wasAutoApproved ? 'Finance' : reviewRole,
                action: 'Approve',
                comment: commentText
            });

            if (reviewError) {
                console.error('Failed to log review:', reviewError);
                // Don't fail the entire operation, but log it
            }

            return { success: true };

        } catch (error) {
            console.error('Approve PAKD Error:', error);
            return { success: false, error };
        }
    },

    async rejectPAKD(planId: string, reason: string): Promise<{ success: boolean; error?: any }> {
        try {
            const currentUser = (await supabase.auth.getUser()).data.user;

            // Get Plan for contract_id and current status
            const { data: plans } = await supabase
                .from('contract_business_plans')
                .select('contract_id, status')
                .eq('id', planId);

            const plan = plans?.[0];


            const { error } = await supabase
                .from('contract_business_plans')
                .update({
                    status: 'Rejected',
                    notes: reason
                })
                .eq('id', planId);

            if (error) throw error;

            // Log Rejection with proper role mapping
            if (plan) {
                const reviewRoleMap: Record<string, 'Unit' | 'Finance' | 'Legal' | 'Board'> = {
                    'Pending_Unit': 'Unit',
                    'Pending_Finance': 'Finance',
                    'Pending_Board': 'Board'
                };
                const reviewRole = reviewRoleMap[plan.status as string] || 'Unit';

                const { error: reviewError } = await supabase.from('contract_reviews').insert({
                    contract_id: plan.contract_id,
                    plan_id: planId,
                    reviewer_id: currentUser?.id,
                    role: reviewRole,
                    action: 'Reject',
                    comment: reason
                });

                if (reviewError) {
                    console.error('Failed to log rejection:', reviewError);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Reject PAKD Error:', error);
            return { success: false, error };
        }
    },

    async submitPAKD(planId: string): Promise<{ success: boolean; error?: any }> {
        return this.approvePAKD(planId, 'NVKD');
    },

    /**
     * Helper to check if user can approve current stage
     */
    checkPermission(currentRole: UserRole, planStatus: PlanStatus, userEmail?: string): boolean {
        const isAdmin = currentRole === 'Admin' || currentRole === 'Leadership';
        if (isAdmin) return true;

        if (planStatus === 'Draft' && (currentRole === 'NVKD' || currentRole === 'UnitLeader')) return true;
        if (planStatus === 'Pending_Unit' && (currentRole === 'UnitLeader' || currentRole === 'AdminUnit')) return true;
        if (planStatus === 'Pending_Finance' && (currentRole === 'Accountant' || currentRole === 'ChiefAccountant')) return true;
        if (planStatus === 'Pending_Board' && currentRole === 'Leadership') return true;

        return false;
    },


    // ==================== CONTRACT REVIEW WORKFLOW (PARALLEL APPROVAL) ====================
    // Flow: Draft → Pending_Review (Legal + Finance approve in parallel) → Both_Approved → Pending_Sign → Active
    // Legal and Finance can approve independently. Once BOTH have approved, status changes to Both_Approved.

    /**
     * Submit contract for review (Draft → Pending_Review)
     * Both Legal and Finance will review in parallel
     */
    async submitContractForReview(contractId: string, draftUrl?: string): Promise<{ success: boolean; error?: any }> {
        console.log('[WorkflowService] submitContractForReview:', { contractId, draftUrl });

        // Get current contract status for audit log
        const { data: currentContract } = await supabase
            .from('contracts')
            .select('status')
            .eq('id', contractId)
            .single();

        const oldStatus = currentContract?.status || 'Draft';

        const updateData: Record<string, any> = {
            status: 'Pending_Review',
            legal_approved: false,
            finance_approved: false
        };
        if (draftUrl) {
            updateData.draft_url = draftUrl;
        }

        const { data, error } = await supabase
            .from('contracts')
            .update(updateData)
            .eq('id', contractId)
            .select();

        console.log('[WorkflowService] Update result:', { data, error });

        if (error) {
            console.error('[WorkflowService] Update failed:', error);
            return { success: false, error };
        }

        // Log review action to contract_reviews
        const { error: reviewError } = await supabase.from('contract_reviews').insert({
            contract_id: contractId,
            role: 'NVKD',
            action: 'Submit',
            comment: draftUrl ? `Gửi duyệt (Pháp lý + Tài chính song song) - Draft: ${draftUrl}` : 'Gửi duyệt (Pháp lý + Tài chính song song)'
        });
        console.log('[WorkflowService] contract_reviews insert:', { reviewError });

        // NOTE: Audit log is automatically created by database trigger (audit_contracts_trigger)
        // No need to manually create AuditLogService.create() here

        return { success: true };
    },

    /**
     * Check if both Legal and Finance have approved, if so update to Both_Approved
     */
    async checkAndAdvanceStatus(contractId: string): Promise<{ advanced: boolean; newStatus?: string }> {
        const { data: contract } = await supabase
            .from('contracts')
            .select('status, legal_approved, finance_approved')
            .eq('id', contractId)
            .single();

        if (!contract) return { advanced: false };

        // Only advance if in Pending_Review and both have approved
        if (contract.status === 'Pending_Review' && contract.legal_approved && contract.finance_approved) {
            const { error } = await supabase
                .from('contracts')
                .update({ status: 'Both_Approved' })
                .eq('id', contractId);

            if (!error) {
                console.log('[WorkflowService] Advanced to Both_Approved');
                return { advanced: true, newStatus: 'Both_Approved' };
            }
        }

        return { advanced: false };
    },

    /**
     * Legal approves contract (Pending_Review → sets legal_approved = true)
     */
    async approveContractLegal(contractId: string, reviewerId: string, comment?: string): Promise<{ success: boolean; error?: any; bothApproved?: boolean }> {
        console.log('[WorkflowService] approveContractLegal:', { contractId, reviewerId, comment });

        const { data, error } = await supabase
            .from('contracts')
            .update({ legal_approved: true })
            .eq('id', contractId)
            .eq('status', 'Pending_Review')
            .select();

        console.log('[WorkflowService] Update result:', { data, error });

        if (error) return { success: false, error };

        await supabase.from('contract_reviews').insert({
            contract_id: contractId,
            reviewer_id: reviewerId,
            role: 'Legal',
            action: 'Approve',
            comment: comment || 'Duyệt pháp lý ✓'
        });

        // Check if both approved
        const { advanced } = await this.checkAndAdvanceStatus(contractId);

        return { success: true, bothApproved: advanced };
    },

    /**
     * Legal rejects contract (Pending_Review → Draft)
     */
    async rejectContractLegal(contractId: string, reviewerId: string, reason: string): Promise<{ success: boolean; error?: any }> {
        const { error } = await supabase
            .from('contracts')
            .update({
                status: 'Draft',
                legal_approved: false,
                finance_approved: false
            })
            .eq('id', contractId);

        if (error) return { success: false, error };

        await supabase.from('contract_reviews').insert({
            contract_id: contractId,
            reviewer_id: reviewerId,
            role: 'Legal',
            action: 'Reject',
            comment: reason
        });

        return { success: true };
    },

    /**
     * Finance approves contract (Pending_Review → sets finance_approved = true)
     */
    async approveContractFinance(contractId: string, reviewerId: string, comment?: string): Promise<{ success: boolean; error?: any; bothApproved?: boolean }> {
        console.log('[WorkflowService] approveContractFinance:', { contractId, reviewerId, comment });

        const { error } = await supabase
            .from('contracts')
            .update({ finance_approved: true })
            .eq('id', contractId)
            .eq('status', 'Pending_Review')
            .select();

        if (error) return { success: false, error };

        await supabase.from('contract_reviews').insert({
            contract_id: contractId,
            reviewer_id: reviewerId,
            role: 'Finance',
            action: 'Approve',
            comment: comment || 'Duyệt tài chính ✓'
        });

        // Check if both approved
        const { advanced } = await this.checkAndAdvanceStatus(contractId);

        return { success: true, bothApproved: advanced };
    },

    /**
     * Finance rejects contract (Pending_Review → Draft)
     */
    async rejectContractFinance(contractId: string, reviewerId: string, reason: string): Promise<{ success: boolean; error?: any }> {
        const { error } = await supabase
            .from('contracts')
            .update({
                status: 'Draft',
                legal_approved: false,
                finance_approved: false
            })
            .eq('id', contractId);

        if (error) return { success: false, error };

        await supabase.from('contract_reviews').insert({
            contract_id: contractId,
            reviewer_id: reviewerId,
            role: 'Finance',
            action: 'Reject',
            comment: reason
        });

        return { success: true };
    },

    /**
     * Submit for leadership signature (Both_Approved → Pending_Sign)
     */
    async submitForSign(contractId: string): Promise<{ success: boolean; error?: any }> {
        const { error } = await supabase
            .from('contracts')
            .update({ status: 'Pending_Sign' })
            .eq('id', contractId)
            .eq('status', 'Both_Approved');

        if (error) return { success: false, error };

        await supabase.from('contract_reviews').insert({
            contract_id: contractId,
            role: 'Leadership',
            action: 'Submit',
            comment: 'Trình lãnh đạo ký'
        });

        return { success: true };
    },

    /**
     * Sign contract (Pending_Sign → Active)
     */
    async signContract(contractId: string, signerId: string): Promise<{ success: boolean; error?: any }> {
        const { error } = await supabase
            .from('contracts')
            .update({
                status: 'Processing',
                signed_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', contractId)
            .eq('status', 'Pending_Sign');

        if (error) return { success: false, error };

        await supabase.from('contract_reviews').insert({
            contract_id: contractId,
            reviewer_id: signerId,
            role: 'Leadership',
            action: 'Sign',
            comment: 'Ký hợp đồng'
        });

        return { success: true };
    },

    /**
     * Check if user can perform contract review action (PARALLEL VERSION)
     */
    checkContractPermission(currentRole: UserRole, contractStatus: string, legalApproved?: boolean, financeApproved?: boolean): {
        canReviewLegal: boolean;
        canReviewFinance: boolean;
        canSubmitSign: boolean;
        canSign: boolean;
    } {
        const isLeadership = currentRole === 'Leadership' || currentRole === 'Admin';

        return {
            // Legal can approve if Pending_Review AND not yet approved by Legal
            canReviewLegal: contractStatus === 'Pending_Review' && !legalApproved && (currentRole === 'Legal' || isLeadership),
            // Finance can approve if Pending_Review AND not yet approved by Finance
            canReviewFinance: contractStatus === 'Pending_Review' && !financeApproved &&
                (currentRole === 'Accountant' || currentRole === 'ChiefAccountant' || isLeadership),
            // Can submit for sign when Both_Approved
            canSubmitSign: contractStatus === 'Both_Approved' && isLeadership,
            canSign: contractStatus === 'Pending_Sign' && isLeadership
        };
    }
};
