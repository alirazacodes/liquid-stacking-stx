
;; title: stacking-rewards
;; version:
;; summary:
;; description:

;; Error codes
(define-constant ERR-UNAUTHORIZED u1)
(define-constant ERR-INVALID-RECIPIENT u2)
(define-constant ERR-INVALID-AMOUNT u3)
(define-constant ERR-INSUFFICIENT-BALANCE u4)
(define-constant ERR-MAX-USERS-REACHED u5)
(define-constant ERR-NOT-A-USER u6)

;; Constant to define the owner of the contract
(define-constant contract-owner tx-sender)

;; Map to store total stacked STX and total rewards
(define-data-var total-stacked-stx uint u0)
(define-data-var total-rewards uint u0)
;; Define a list of all users
(define-data-var user-list (list 200 principal) (list))
(define-data-var conversion-rate uint u0) ; The conversion rate from BTC to STX, represented as an integer


;; Map to store user's STX stacks and rewards
(define-map users
  principal
  {stacked-stx: uint, sbtc-rewards: uint}
)

;; Check if caller is contract owner
(define-private (is-contract-owner)
  (is-eq contract-owner tx-sender)
)

;; Helper function to distribute rewards to a single user
(define-private (distribute-reward-to-user (user principal) (unused uint))
  (let (
    (user-details (unwrap-panic (map-get? users user)))
    (total-stx (var-get total-stacked-stx))
    (current-total-rewards (var-get total-rewards))  ;; renamed the variable
  )
    (map-set users user
      {
        stacked-stx: (get stacked-stx user-details),
        sbtc-rewards: (+ (get sbtc-rewards user-details) (/ (* current-total-rewards (get stacked-stx user-details)) total-stx))
      }
    )
    unused  ;; return unused
  )
)

(define-public (stack-stx (amount uint))
  (let (
    (user-entry (map-get? users tx-sender))
    (current-user-list (var-get user-list))
  )
    (asserts! (< (len current-user-list) u200) (err ERR-MAX-USERS-REACHED))
    (var-set user-list (unwrap-panic (as-max-len? (append current-user-list tx-sender) u200)))
    (if (is-none user-entry)
      (begin
        (map-set users tx-sender {stacked-stx: amount, sbtc-rewards: u0})
      )
      (let ((entry (unwrap-panic user-entry)))
        (map-set users tx-sender {stacked-stx: (+ amount (get stacked-stx entry)), sbtc-rewards: (get sbtc-rewards entry)})
      )
    )
    (var-set total-stacked-stx (+ amount (var-get total-stacked-stx)))
    (ok true)
  )
)


(define-public (unstack-stx (amount uint))
  (let (
    (user-entry (unwrap-panic (map-get? users tx-sender)))
    (current-user-list (var-get user-list))
  )
    (asserts! (>= (get stacked-stx user-entry) amount) (err ERR-INSUFFICIENT-BALANCE))
    (map-set users tx-sender {stacked-stx: (- (get stacked-stx user-entry) amount), sbtc-rewards: (get sbtc-rewards user-entry)})
    (var-set total-stacked-stx (- (var-get total-stacked-stx) amount))
    (ok true)
  )
)

(define-public (withdraw-rewards)
  (let (
    (user-entry (unwrap-panic (map-get? users tx-sender)))
  )
    (map-set users tx-sender {stacked-stx: (get stacked-stx user-entry), sbtc-rewards: u0})
    (ok (get sbtc-rewards user-entry))
  )
)


;; (define-public (convert-rewards (btc-amount uint))
;;   (let (
;;     (conversion-rate (unwrap-panic (contract-call? .oracle-contract get-btc-stx-rate u1)))
;;   )
;;     (ok (* btc-amount conversion-rate))
;;   )
;; )

;; Function to convert rewards
(define-public (convert-rewards (btc-amount uint))
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (var-set total-rewards (+ btc-amount (var-get total-rewards)))
    (ok true)
  )
)

;; Function to distribute rewards
(define-public (distribute-rewards)
  (begin
    (asserts! (is-contract-owner) (err ERR-UNAUTHORIZED))
    (let ((current-user-list (var-get user-list)))
      (fold distribute-reward-to-user current-user-list u0)
    )
    (var-set total-rewards u0)
    (ok true)
  )
)


;; Read-only function to get user details
(define-read-only (get-user-details (user principal))
  (map-get? users user)
)

;; Read-only function to get total stacked STX and total rewards
(define-read-only (get-total-stacked-stx-and-rewards)
  {
    total-stacked-stx: (var-get total-stacked-stx),
    total-rewards: (var-get total-rewards)
  }
)

