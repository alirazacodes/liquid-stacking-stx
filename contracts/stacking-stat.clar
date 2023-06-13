
;; title: stacking-stat
;; version:
;; summary:
;; description:

(define-constant ERR_NOT_AUTHORIZED u1)
(define-constant ERR_INVALID_AMOUNT u2)
(define-constant ERR_NO_POOLED_STX u3)
(define-constant ERR_REBALANCE_IN_PROGRESS u4)
(define-constant ERR_OVERFLOW u5)
(define-constant ERR_INVALID_STRATEGY_ID u6)

(define-data-var strategy-owner principal tx-sender)
(define-data-var rebalance-in-progress bool false)
(define-data-var total-pooled-stx uint u0)

(define-map strategy-map { id: uint } { allocation: uint, active: bool })
(define-map pooled-stx { id: uint } { amount: uint, strategy-id: uint })

(define-read-only (get-strategy (id uint))
  (map-get? strategy-map { id: id })
)

(define-read-only (get-user-details (id uint))
  (map-get? pooled-stx { id: id })
)

(define-private (add-amount (acc uint) (id uint))
  (+ 
    acc 
    (unwrap-panic 
      (get amount 
        (map-get? pooled-stx { id: id })
      )
    )
  )
)

(define-public (set-strategy (id uint) (allocation uint))
  (begin
    (asserts! 
      (is-eq tx-sender (var-get strategy-owner)) 
      (err ERR_NOT_AUTHORIZED)
    )
    (map-set strategy-map { id: id } { allocation: allocation, active: true })
    (ok true)
  )
)

(define-public (rebalance)
  (begin
    (asserts! 
      (is-eq tx-sender (var-get strategy-owner)) 
      (err ERR_NOT_AUTHORIZED)
    )
    (asserts! 
      (not (var-get rebalance-in-progress)) 
      (err ERR_REBALANCE_IN_PROGRESS)
    )
    (var-set rebalance-in-progress true)
    ;; Here the actual rebalance algorithm would be implemented. 
    ;; This could involve several transactions and complex logic.
    (var-set rebalance-in-progress false)
    (ok true)
  )
)

(define-public (optimize)
  (begin
    (asserts! 
      (is-eq tx-sender (var-get strategy-owner)) 
      (err ERR_NOT_AUTHORIZED)
    )
    ;; Here the actual optimize algorithm would be implemented. 
    ;; This could involve several transactions and complex logic.
    (ok true)
  )
)

(define-public (add-to-pool (amount uint) (user-id uint) (strategy-id uint))
  (let ((current-amount (default-to u0 (get amount (map-get? pooled-stx { id: user-id })))))
    (let ((new-amount (+ current-amount amount)))
      (if (and (>= new-amount current-amount)
               (< amount u18446744073709551615))
        (begin
          (map-set pooled-stx { id: user-id } { amount: new-amount, strategy-id: strategy-id })
          (var-set total-pooled-stx (+ (var-get total-pooled-stx) amount))
          (ok amount)
        )
        (err ERR_OVERFLOW)
      )
    )
  )
)

(define-public (remove-from-pool (amount uint) (user-id uint))
  (let ((current-amount (unwrap-panic (get amount (map-get? pooled-stx { id: user-id })))))
    (if (>= current-amount amount)
      (let ((new-amount (- current-amount amount)))
        (begin
          (map-set pooled-stx { id: user-id } { amount: new-amount, strategy-id: (unwrap-panic (get strategy-id (map-get? pooled-stx { id: user-id })))})
          (var-set total-pooled-stx (- (var-get total-pooled-stx) amount))
          (ok amount)
        )
      )
      (err ERR_INVALID_AMOUNT)
    )
  )
)

(define-public (set-strategy-owner (new-owner principal))
  (begin
    (asserts!
      (is-eq tx-sender (var-get strategy-owner))
      (err ERR_NOT_AUTHORIZED)
    )
    (var-set strategy-owner new-owner)
    (ok true)
  )
)

(define-public (pause-strategy (id uint))
  (begin
    (asserts!
      (is-eq tx-sender (var-get strategy-owner))
      (err ERR_NOT_AUTHORIZED)
    )
    (match (map-get? strategy-map { id: id })
      strategy 
        (begin
          (map-set strategy-map { id: id } { allocation: (get allocation strategy), active: false })
          (ok true)
        )
      (err ERR_INVALID_STRATEGY_ID)
    )
  )
)

(define-public (resume-strategy (id uint))
  (begin
    (asserts!
      (is-eq tx-sender (var-get strategy-owner))
      (err ERR_NOT_AUTHORIZED)
    )
    (match (map-get? strategy-map { id: id })
      strategy 
        (begin
          (map-set strategy-map { id: id } { allocation: (get allocation strategy), active: true })
          (ok true)
        )
      (err ERR_INVALID_STRATEGY_ID)
    )
  )
)

(define-read-only (get-total-pooled-stx)
  (var-get total-pooled-stx)
)
