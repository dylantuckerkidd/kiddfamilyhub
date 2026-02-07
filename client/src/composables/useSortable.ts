import Sortable from 'sortablejs'
import { onMounted, onUnmounted, type Ref } from 'vue'

export function useSortable(elRef: Ref<HTMLElement | null>, onReorder: (oldIndex: number, newIndex: number) => void) {
  let sortable: Sortable | null = null

  onMounted(() => {
    if (elRef.value) {
      sortable = Sortable.create(elRef.value, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'opacity-30',
        onEnd: (evt) => {
          if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
            onReorder(evt.oldIndex, evt.newIndex)
          }
        }
      })
    }
  })

  onUnmounted(() => { sortable?.destroy() })
}
