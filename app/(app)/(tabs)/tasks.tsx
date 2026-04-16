import { Redirect } from 'expo-router'
import ConfigureHouseholdTasksScreen from '../household/configure-tasks'
import { useMenuContext } from '../../../lib/menu-context'

export default function TasksTabScreen() {
	const { canManageTasks } = useMenuContext()

	if (!canManageTasks) {
		return <Redirect href="/(app)/(tabs)/today" />
	}

	return <ConfigureHouseholdTasksScreen />
}
