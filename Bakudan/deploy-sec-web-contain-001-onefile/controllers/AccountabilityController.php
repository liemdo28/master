<?php
/**
 * AccountabilityController — CEO read-only accountability dashboard.
 *
 * Route: GET /ceo/accountability
 * Access: CEO and Admin (read-only; no operational editing)
 */
class AccountabilityController {
    private Penalty     $penaltyModel;
    private PenaltyRule $ruleModel;

    public function __construct() {
        $this->penaltyModel = new Penalty();
        $this->ruleModel    = new PenaltyRule();
    }

    public function index(): void {
        if (!isCeo() && !isAdmin()) {
            redirect('overview');
            return;
        }

        $data    = $this->penaltyModel->getOrgAccountability();
        $rules   = $this->ruleModel->getActive();
        $appeals = $this->ruleModel->getAllPendingAppeals();

        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($_SESSION['user_id']);
        $projects      = (new Project())->getByUser($_SESSION['user_id'], true);

        require __DIR__ . '/../views/ceo/accountability.php';
    }
}
