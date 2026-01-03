
// App_phase4C4_modal_alignment.js
// Purpose: Fix iOS modal touch alignment by avoiding transformed hit targets
// Safe: Modal-only changes, no impact on navigation, catalog, or story systems

(function () {
  // Utility: close modal safely
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('vc-modal-open');
  }

  // Attach handlers once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.vc-modal').forEach(modal => {
      const closeBtn = modal.querySelector('.vc-modal-close');
      const backdrop = modal.querySelector('.vc-modal-backdrop');

      if (closeBtn) {
        // Use touchend + click for iOS reliability
        closeBtn.addEventListener('touchend', e => {
          e.preventDefault();
          e.stopPropagation();
          closeModal(modal);
        }, { passive: false });

        closeBtn.addEventListener('click', e => {
          e.preventDefault();
          closeModal(modal);
        });
      }

      if (backdrop) {
        backdrop.addEventListener('touchend', e => {
          e.preventDefault();
          closeModal(modal);
        }, { passive: false });

        backdrop.addEventListener('click', () => closeModal(modal));
      }
    });
  });
})();
