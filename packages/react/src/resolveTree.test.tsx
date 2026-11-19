import { Fragment } from 'react'
import { findAll, resolveTree } from './resolveTree'

const Name = ({ name }: { name: string }) => <b>{name}</b>
const Later = async ({ children }: { children?: React.ReactNode }) => {
  await Promise.resolve()
  return <section>{children}</section>
}

describe('resolveTree', () => {
  it('calls function components, sync and async, and flattens fragments and arrays', async () => {
    const tree = await resolveTree(
      <Later>
        <Name name="a" />
        <>
          {[<i key="1">1</i>, <i key="2">{2}</i>]}
          {null}
          {false}
          {undefined}
          text
        </>
      </Later>
    )
    expect(tree).toEqual([
      {
        type: 'section',
        props: {},
        children: [
          { type: 'b', props: {}, children: ['a'] },
          { type: 'i', props: {}, children: ['1'] },
          { type: 'i', props: {}, children: ['2'] },
          'text',
        ],
      },
    ])
  })

  it('keeps the props of a host element, and resolves a fragment on its own', async () => {
    expect(await resolveTree(<Fragment>{<a href="#x" />}</Fragment>)).toEqual([
      { type: 'a', props: { href: '#x' }, children: [] },
    ])
  })

  it('renders in order: a component runs before its children', async () => {
    const order: string[] = []
    const Child = () => {
      order.push('child')
      return null
    }
    const Parent = ({ children }: { children?: React.ReactNode }) => {
      order.push('parent')
      return children
    }
    await resolveTree(
      <Parent>
        <Child />
      </Parent>
    )
    expect(order).toEqual(['parent', 'child'])
  })

  it('throws for something that is not a node', async () => {
    await expect(resolveTree({} as never)).rejects.toThrow('needs elements')
  })
})

describe('findAll', () => {
  it('finds the elements of a type, below others, in order', async () => {
    const tree = await resolveTree(
      <div>
        <p>
          <i />
        </p>
        text
        <i />
      </div>
    )
    expect(findAll(tree, 'i')).toHaveLength(2)
    expect(findAll(tree, 'p')).toHaveLength(1)
    expect(findAll(tree, 'span')).toEqual([])
  })
})
