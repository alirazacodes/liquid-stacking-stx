
;; title: liquid-stacking
;; version:
;; summary:
;; description:

(define-constant ERR_STACK_INSUFFICIENT_FUNDS u1)
(define-constant ERR_UNSTACK_INSUFFICIENT_STACKED u2)
(define-constant ERR_USER_NOT_FOUND u3)

(define-map user-stacks
  { user: principal }
  { stacked: uint })

(define-map total-stacks
  { id: uint }
  { total: uint })

(define-private (get-user-stacks (user principal))
  (map-get? user-stacks { user: user })
)


(define-private (get-total-stacks)
  (default-to { total: u0 } 
    (map-get? total-stacks { id: u1 })
  )
)

(define-public (stack (amount uint))
  (match (get-user-stacks tx-sender)
    current-stacks 
      (begin
        (if (>= (stx-get-balance tx-sender) amount)
          (begin
            (map-set user-stacks 
              { user: tx-sender }
              { stacked: (+ (get stacked current-stacks) amount) })
            (map-set total-stacks
              { id: u1 }
              { total: (+ (get total (get-total-stacks)) amount) })
            (ok amount)
          )
          (err ERR_STACK_INSUFFICIENT_FUNDS)
        )
      )
    (err ERR_USER_NOT_FOUND)
  )
)

(define-public (unstack (amount uint))
  (match (get-user-stacks tx-sender)
    current-stacks
      (if (>= (get stacked current-stacks) amount)
        (begin
          (map-set user-stacks 
            { user: tx-sender }
            { stacked: (- (get stacked current-stacks) amount) })
          (map-set total-stacks
            { id: u1 }
            { total: (- (get total (get-total-stacks)) amount) })
          (ok amount)
        )
        (err ERR_UNSTACK_INSUFFICIENT_STACKED)
      )
    (err ERR_USER_NOT_FOUND)
  )
)


(define-read-only (get-stack-info (user principal))
  (get-user-stacks user)
)


